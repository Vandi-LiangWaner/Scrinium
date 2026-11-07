const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mergeLegacyLibraries, applyLibraryChanges } = require("../desktop/library-sync.cjs");

test("migration preserves divergent cards and retargets links from the Stacks library", () => {
  const shared = { id: 1, title: "Shared" };
  const original = { id: 2, title: "Review", notes: "Classic text" };
  const changed = { ...original, notes: "Stacks text" };
  const note = { id: 3, title: "Synthesis", relatedCardIds: [2], notes: '<a href="#card-2">Review</a>' };
  const merged = mergeLegacyLibraries([shared, original], {
    cards: [shared, changed, note],
    collectionCategories: { note: ["Drafts"] },
  });
  assert.equal(merged.cards.length, 4);
  const copy = merged.cards.find(card => card.notes === "Stacks text");
  const synthesis = merged.cards.find(card => card.id === note.id);
  assert.equal(copy.title, "Review (Stacks copy)");
  assert.deepEqual(synthesis.relatedCardIds, [copy.id]);
  assert.equal(synthesis.notes, `<a href="#card-${copy.id}">Review</a>`);
  assert.deepEqual(merged.collectionCategories.note, ["Drafts"]);
});

const changes = (id, fields) => ({ added: [], removed: [], updated: [{ id, fields }], collectionCategories: {} });

test("concurrent writes merge different fields and preserve overlapping edits as copies", () => {
  const card = { id: 1, title: "Review", notes: "Saved by Classic" };
  const source = { cards: [card] };
  const merged = applyLibraryChanges(source, changes(1, [
    { key: "title", before: "Review", after: "Edited title" },
  ]), true, new Map());
  assert.deepEqual(merged.state.cards, [{ ...card, title: "Edited title" }]);
  const conflict = applyLibraryChanges(source, changes(1, [
    { key: "notes", before: "Previous draft", after: "Saved by Stacks" },
  ]), true, new Map());
  assert.equal(conflict.conflicts, true);
  assert.deepEqual(conflict.state.cards[0], card);
  assert.equal(conflict.state.cards[1].notes, "Saved by Stacks");
  assert.notEqual(conflict.state.cards[1].id, card.id);
});
