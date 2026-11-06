import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type CardPatch = { index: number; id: number; fields: Record<string, unknown> };
type LibraryState = {
  cards: { id: number }[];
  statuses: string[];
  topicOrder: string[];
  collectionCategories?: object;
};

function withDrafts<State extends LibraryState>(state: State, drafts: Map<number, State["cards"][number]>): State {
  if (!drafts.size) return state;
  return { ...state, cards: state.cards.map(card => drafts.get(card.id) ?? card) };
}

// Keep the existing snapshot format. Ordinary edits can send a small patch
// through IPC without copying figures or serializing the entire library.
function cardPatch(before: LibraryState, after: LibraryState): CardPatch | null | undefined {
  if (before.statuses !== after.statuses || before.topicOrder !== after.topicOrder ||
      before.collectionCategories !== after.collectionCategories ||
      before.cards.length !== after.cards.length) return null;

  let patch: CardPatch | null = null;
  for (const [index, card] of after.cards.entries()) {
    const previous = before.cards[index];
    if (previous === card) continue;
    if (patch || previous.id !== card.id) return null;
    const fields = Object.fromEntries(Object.entries(card).filter(([key, value]) =>
      value !== (previous as Record<string, unknown>)[key]));
    if (Object.keys(previous).some(key => !Object.hasOwn(card, key)) ||
        Object.values(fields).some(value => value === undefined)) return null;
    if (Object.keys(fields).length) patch = { index, id: card.id, fields };
  }
  return patch ?? undefined;
}

async function stringifyOffThread(state: LibraryState): Promise<string> {
  if (typeof Worker === "undefined") return JSON.stringify(state);
  const url = URL.createObjectURL(new Blob([
    "self.onmessage = ({data}) => self.postMessage(JSON.stringify(data))",
  ], { type: "text/javascript" }));
  try {
    const worker = new Worker(url);
    try {
      return await new Promise<string>((resolve, reject) => {
        worker.onmessage = event => resolve(event.data);
        worker.onerror = reject;
        worker.onmessageerror = reject;
        worker.postMessage(state);
      });
    } finally {
      worker.terminate();
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function useLibrarySave<State extends LibraryState>(
  state: State,
  ready: boolean,
  saveBrowserState: (state: State) => Promise<void>,
) {
  const [status, setStatus] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const library = useRef<State | null>(null);
  const drafts = useRef(new Map<number, State["cards"][number]>());
  const latest = useRef<State | null>(null);
  const saved = useRef<State | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNow = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) return inFlight.current;
    if (latest.current === saved.current) return Promise.resolve(true);
    setStatus("saving");
    const run = async () => {
      try {
        while (latest.current && latest.current !== saved.current) {
          const next = latest.current;
          const desktop = window.literatureBox;
          if (desktop) {
            const patch = saved.current ? cardPatch(saved.current, next) : null;
            if (patch !== undefined) {
              const patched = patch && await desktop.patchCard(patch);
              if (!patched && !await desktop.saveCards(await stringifyOffThread(next))) {
                throw new Error("The desktop database did not acknowledge the save.");
              }
            }
          } else {
            await saveBrowserState(next);
          }
          saved.current = next;
        }
        setStatus("saved");
        return true;
      } catch (error) {
        console.error("Literature Box save failed", error);
        setStatus("error");
        return false;
      }
    };
    inFlight.current = run().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }, [saveBrowserState]);

  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(() => void saveNow(), 120);
  }, [saveNow]);

  // Autosave the open card without replacing the collection being rendered.
  // Publish the draft to the deck when the editor is left or explicitly saved.
  const stageCard = useCallback((card: State["cards"][number]) => {
    if (!library.current) return;
    drafts.current.set(card.id, card);
    latest.current = withDrafts(library.current, drafts.current);
    schedule();
  }, [schedule]);
  const stagedCard = useCallback((id: number) => drafts.current.get(id), []);
  const discardStagedCards = useCallback((id?: number) => {
    if (id === undefined) drafts.current.clear();
    else drafts.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    library.current = state;
    if (drafts.current.size) {
      for (const card of state.cards) if (drafts.current.get(card.id) === card) drafts.current.delete(card.id);
    }
    latest.current = withDrafts(state, drafts.current);
  }, [state, ready]);

  useEffect(() => {
    if (ready) schedule();
  }, [state, ready, schedule]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  return { status, saveNow, stageCard, stagedCard, discardStagedCards, hasUnsaved: useCallback(() => latest.current !== saved.current, []) };
}
