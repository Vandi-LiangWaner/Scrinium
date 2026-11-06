const path = require("node:path");
const fs = require("node:fs");
const Database = require("better-sqlite3");

const { parentPort } = process;
const { file, backupFile, sourceFile } = JSON.parse(process.argv[2]);
let db, loadState, saveState;
let backupTimer = null;
let backupInFlight = false;
let backupQueued = false;

async function openDatabase() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (sourceFile && !fs.existsSync(file) && fs.existsSync(sourceFile)) {
    const source = new Database(sourceFile, { readonly: true, fileMustExist: true });
    const temporary = file + ".import-" + process.pid;
    try {
      await source.backup(temporary);
      // If another launch already initialized the library, retain that copy.
      try { fs.linkSync(temporary, file); }
      catch (error) {
        if (error.code !== "EEXIST") {
          if (!["ENOTSUP", "EPERM", "ENOSYS"].includes(error.code)) throw error;
          try { fs.copyFileSync(temporary, file, fs.constants.COPYFILE_EXCL); }
          catch (copyError) { if (copyError.code !== "EEXIST") throw copyError; }
        }
      }
    } finally {
      source.close();
      fs.rmSync(temporary, { force: true });
    }
  }
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec("CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), cards_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
  loadState = db.prepare("SELECT cards_json FROM app_state WHERE id=1");
  saveState = db.prepare("INSERT INTO app_state(id,cards_json,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET cards_json=excluded.cards_json,updated_at=excluded.updated_at");
}

function queueBackup() {
  backupQueued = true;
  if (backupTimer || backupInFlight) return;
  backupTimer = setTimeout(async () => {
    backupTimer = null;
    backupQueued = false;
    backupInFlight = true;
    try {
      fs.mkdirSync(path.dirname(backupFile), { recursive: true });
      await db.backup(backupFile);
    } catch (error) {
      console.error("Literature Box backup failed", error);
    } finally {
      backupInFlight = false;
      if (backupQueued) queueBackup();
    }
  }, 60_000);
}

function patchCard({ index, id, fields }) {
  const entries = Object.entries(fields);
  if (!Number.isSafeInteger(index) || index < 0 || !Number.isFinite(id) ||
      !entries.length || entries.length > 24 ||
      entries.some(([key]) => key === "id" || !/^[a-zA-Z]+$/.test(key))) return false;
  const cardPath = `$.cards[${index}]`;
  const values = entries.flatMap(([key, value]) => [`${cardPath}.${key}`, JSON.stringify(value)]);
  const args = entries.map(() => "?, json(?)").join(", ");
  const result = db.prepare(`
    UPDATE app_state SET cards_json=json_set(cards_json, ${args}), updated_at=?
    WHERE id=1 AND json_extract(cards_json, ?) = ?
  `).run(...values, new Date().toISOString(), `${cardPath}.id`, id);
  if (result.changes) queueBackup();
  return result.changes === 1;
}

const ready = openDatabase().then(() => null, error => error);
parentPort.on("message", async ({ data: { requestId, method, payload } }) => {
  try {
    const error = await ready;
    if (error) throw error;
    let value;
    if (method === "load") value = loadState.get()?.cards_json ?? null;
    else if (method === "patch") value = patchCard(payload);
    else if (method === "save") {
      const json = typeof payload === "string" ? payload : JSON.stringify(payload);
      saveState.run(json, new Date().toISOString());
      queueBackup();
      value = true;
    } else throw new Error("Unknown database operation");
    parentPort.postMessage({ requestId, value });
  } catch (error) {
    parentPort.postMessage({ requestId, error: error.message });
  }
});
