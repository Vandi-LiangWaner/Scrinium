const path = require("node:path");
const fs = require("node:fs");
const { setTimeout: delay } = require("node:timers/promises");
const Database = require("better-sqlite3");
const { mergeLegacyLibraries, applyLibraryChanges } = require("./library-sync.cjs");

const { parentPort } = process;
const { file, backupFile, legacyFiles } = JSON.parse(process.argv[2]);
let db, loadState, revision, writeChanges, cardIndex;
let backupTimer = null;
let backupInFlight = false;
let backupQueued = false;

function readLegacy(file) {
  if (!fs.existsSync(file)) return null;
  const source = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const initialized = source.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='app_state'").get();
    if (!initialized) return null;
    const record = source.prepare("SELECT cards_json FROM app_state WHERE id=1").get();
    return record ? JSON.parse(record.cards_json) : null;
  } finally {
    source.close();
  }
}

function openDatabase() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  if (db.pragma("journal_mode", { simple: true }) !== "wal") db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), cards_json TEXT NOT NULL, revision INTEGER NOT NULL)");
  revision = db.prepare("SELECT revision FROM app_state WHERE id=1");
  loadState = db.prepare("SELECT revision, cards_json AS json FROM app_state WHERE id=1");
  cardIndex = db.prepare(`
    SELECT card.key AS position FROM app_state, json_each(cards_json, '$.cards') AS card
    WHERE app_state.id=1 AND json_extract(card.value, '$.id')=? LIMIT 1
  `);
  const saveState = db.prepare("INSERT INTO app_state(id,cards_json,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET cards_json=excluded.cards_json,revision=excluded.revision");

  db.transaction(() => {
    if (revision.get()) return;
    const [classic, stacks] = legacyFiles.map(readLegacy);
    if (classic || stacks) saveState.run(JSON.stringify(mergeLegacyLibraries(classic, stacks)), 1);
  }).immediate();

  writeChanges = db.transaction(({ baseRevision, changes, recover = [] }) => {
    const current = revision.get()?.revision ?? 0;
    const concurrent = current !== baseRevision;
    if (!concurrent && patchCard(changes, current + 1)) return { revision: current + 1, reconcile: false };
    const record = loadState.get();
    const source = record ? JSON.parse(record.json) : null;
    const present = new Set(source?.cards.map(card => card.id));
    const recovery = new Map(recover.map(card => [card.id, card]));
    const missing = changes.updated.map(card => card.id).filter(id => !present.has(id) && !recovery.has(id));
    if (missing.length) return { missing };
    const { state, conflicts } = applyLibraryChanges(source, changes, concurrent, recovery);
    saveState.run(JSON.stringify(state), current + 1);
    return { revision: current + 1, reconcile: concurrent || conflicts };
  }).immediate;
}

function patchCard(changes, nextRevision) {
  if (changes.added.length || changes.removed.length || changes.updated.length !== 1 ||
      changes.statuses || changes.topicOrder || Object.keys(changes.collectionCategories).length) return false;
  const { id, fields } = changes.updated[0];
  if (!fields.length || fields.length > 24 || fields.some(({ key, after }) =>
    key === "id" || !/^[a-zA-Z]+$/.test(key) || after === undefined)) return false;
  const entry = cardIndex.get(id);
  if (!entry) return false;
  const values = fields.flatMap(({ key, after }) => [
    `$.cards[${entry.position}].${key}`, JSON.stringify(after),
  ]);
  const args = fields.map(() => "?, json(?)").join(", ");
  db.prepare(`UPDATE app_state SET cards_json=json_set(cards_json, ${args}), revision=? WHERE id=1`)
    .run(...values, nextRevision);
  return true;
}

function queueBackup() {
  backupQueued = true;
  if (backupTimer || backupInFlight) return;
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    backupQueued = false;
    backupInFlight = true;
    const temporary = backupFile + "." + process.pid;
    try {
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      await db.backup(temporary);
      fs.renameSync(temporary, backupFile);
    } catch (error) {
      console.error("Literature Box backup failed", error);
    } finally {
      fs.rmSync(temporary, { force: true });
      backupInFlight = false;
      if (backupQueued) queueBackup();
    }
  }, 60_000);
}

async function startDatabase() {
  for (let attempt = 0; ; attempt++) {
    try {
      openDatabase();
      return null;
    } catch (error) {
      db?.close();
      db = undefined;
      if (attempt === 5 || !["SQLITE_BUSY", "SQLITE_LOCKED"].includes(error.code)) return error;
      await delay(40 * (attempt + 1));
    }
  }
}
const ready = startDatabase();

parentPort.on("message", async ({ data: { requestId, method, payload } }) => {
  try {
    const startupError = await ready;
    if (startupError) throw startupError;
    let value;
    if (method === "load") {
      const current = revision.get()?.revision ?? 0;
      value = current === payload ? null : loadState.get() ?? { revision: 0, json: null };
    } else if (method === "save") {
      value = writeChanges(JSON.parse(payload));
      if (value.revision !== undefined) queueBackup();
    } else throw new Error("Unknown database operation");
    parentPort.postMessage({ requestId, value });
  } catch (error) {
    parentPort.postMessage({ requestId, error: error.message });
  }
});
