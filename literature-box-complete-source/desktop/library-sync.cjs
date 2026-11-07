const { isDeepStrictEqual } = require("node:util");

const collections = ["author", "journal", "note"];
const labelKey = value => value.toLowerCase();
const unique = values => [...new Map(values.map(value => [labelKey(value), value])).values()];
const sameCard = (left, right) => {
  const { createdAt: leftTime, ...a } = left;
  const { createdAt: rightTime, ...b } = right;
  return isDeepStrictEqual({ ...a, kind: a.kind || "paper" }, { ...b, kind: b.kind || "paper" });
};

function normalizeLibrary(value) {
  const source = Array.isArray(value) ? { cards: value } : value;
  return {
    cards: source?.cards || [],
    statuses: source?.statuses || ["To read", "Reading", "Read", "Annotated"],
    topicOrder: source?.topicOrder || [],
    collectionCategories: Object.fromEntries(collections.map(kind => [kind, source?.collectionCategories?.[kind] || []])),
  };
}

function allocateIds(cards) {
  const used = new Set(cards.map(card => card.id));
  let next = Date.now();
  return () => {
    while (used.has(next)) next++;
    used.add(next);
    return next++;
  };
}

function remapLinks(card, ids) {
  const remapText = text => text.replace(/(href\s*=\s*["'])#card-(\d+)(?=["'])/gi,
    (match, prefix, id) => ids.has(Number(id)) ? `${prefix}#card-${ids.get(Number(id))}` : match);
  return {
    ...card,
    ...(card.findings && { findings: remapText(card.findings) }),
    ...(card.notes && { notes: remapText(card.notes) }),
    ...(card.relatedCardIds && { relatedCardIds: card.relatedCardIds.map(id => ids.get(id) ?? id) }),
  };
}

function mergeLegacyLibraries(classic, stacks) {
  if (!classic || !stacks) return normalizeLibrary(classic || stacks);
  const first = normalizeLibrary(classic);
  const second = normalizeLibrary(stacks);
  const byId = new Map(first.cards.map(card => [card.id, card]));
  const newId = allocateIds([...first.cards, ...second.cards]);
  const ids = new Map();
  const copies = second.cards.flatMap(card => {
    const original = byId.get(card.id);
    if (!original) return [card];
    if (sameCard(original, card)) return [];
    const id = newId();
    ids.set(card.id, id);
    return [{ ...card, id, title: card.title + " (Stacks copy)" }];
  });
  return {
    cards: [...first.cards, ...copies.map(card => remapLinks(card, ids))],
    statuses: unique([...first.statuses, ...second.statuses]),
    topicOrder: unique([...first.topicOrder, ...second.topicOrder]),
    collectionCategories: Object.fromEntries(collections.map(kind =>
      [kind, unique([...first.collectionCategories[kind], ...second.collectionCategories[kind]])])),
  };
}

function mergeList(current, { before, after }) {
  const beforeKeys = new Set(before.map(labelKey));
  const afterKeys = new Set(after.map(labelKey));
  const currentKeys = new Set(current.map(labelKey));
  return unique([
    ...after.filter(value => !beforeKeys.has(labelKey(value)) || currentKeys.has(labelKey(value))),
    ...current.filter(value => !beforeKeys.has(labelKey(value)) && !afterKeys.has(labelKey(value))),
  ]);
}

function applyLibraryChanges(source, changes, concurrent, recovery) {
  const state = normalizeLibrary(source);
  const cards = new Map(state.cards.map(card => [card.id, card]));
  const newId = allocateIds([...state.cards, ...changes.added]);
  let conflicts = false;
  for (const previous of changes.removed) {
    const current = cards.get(previous.id);
    if (!current) continue;
    if (concurrent && !sameCard(current, previous)) {
      conflicts = true;
      const id = newId();
      cards.set(id, { ...current, id, title: current.title + " (concurrent edit)" });
    }
    cards.delete(current.id);
  }

  const added = [];
  const ids = new Map();
  for (const card of changes.added) {
    const current = cards.get(card.id);
    if (!current) added.push(card);
    else if (!sameCard(current, card)) {
      conflicts = true;
      const id = newId();
      ids.set(card.id, id);
      added.push({ ...card, id, title: card.title + " (concurrent edit)" });
    }
  }

  for (const { id, fields } of changes.updated) {
    const current = cards.get(id);
    const original = current || recovery.get(id);
    if (!original) throw new Error("The card changed in the other edition and its previous version is unavailable.");
    const desired = { ...original };
    let overlap = !current;
    for (const { key, before, after } of fields) {
      if (concurrent && !isDeepStrictEqual(original[key], before) && !isDeepStrictEqual(original[key], after)) overlap = true;
      if (after === undefined) delete desired[key];
      else desired[key] = after;
    }
    if (overlap) {
      conflicts = true;
      const copyId = newId();
      cards.set(copyId, { ...desired, id: copyId, title: desired.title + " (concurrent edit)" });
    } else {
      cards.set(id, desired);
    }
  }

  for (const card of added) cards.set(card.id, remapLinks(card, ids));
  state.cards = [...cards.values()];
  for (const key of ["statuses", "topicOrder"]) {
    if (changes[key]) state[key] = concurrent ? mergeList(state[key], changes[key]) : changes[key].after;
  }
  for (const kind of collections) {
    const change = changes.collectionCategories[kind];
    if (change) state.collectionCategories[kind] = concurrent ? mergeList(state.collectionCategories[kind], change) : change.after;
  }
  return { state, conflicts };
}

module.exports = { mergeLegacyLibraries, applyLibraryChanges };
