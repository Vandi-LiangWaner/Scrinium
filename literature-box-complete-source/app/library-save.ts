import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type CardPatch = { index: number; id: number; fields: Record<string, unknown> };
type LibraryState = {
  cards: { id: number }[];
  statuses: string[];
  topicOrder: string[];
  collectionCategories?: object;
};

// Keep the existing snapshot format. Ordinary edits can send a small patch
// through IPC without copying figures or serializing the entire library.
function cardPatch(before: LibraryState, after: LibraryState): CardPatch | null {
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
  return patch;
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
  const latest = useRef<State | null>(null);
  const saved = useRef<State | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const saveNow = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    if (latest.current === saved.current) return Promise.resolve(true);
    setStatus("saving");
    const run = async () => {
      try {
        while (latest.current && latest.current !== saved.current) {
          const next = latest.current;
          const desktop = window.literatureBox;
          if (desktop) {
            const patch = saved.current && cardPatch(saved.current, next);
            const patched = patch && await desktop.patchCard(patch);
            if (!patched && !await desktop.saveCards(await stringifyOffThread(next))) {
              throw new Error("The desktop database did not acknowledge the save.");
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

  useLayoutEffect(() => {
    if (ready) latest.current = state;
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    setStatus("saving");
    const timer = setTimeout(() => void saveNow(), 120);
    return () => clearTimeout(timer);
  }, [state, ready, saveNow]);

  return { status, saveNow, hasUnsaved: useCallback(() => latest.current !== saved.current, []) };
}
