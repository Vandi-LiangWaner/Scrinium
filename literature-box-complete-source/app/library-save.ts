import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { CategoryOrder } from "./category-tabs";

type Card = { id: number };
type CategoryCollection = "author" | "journal" | "note";
type LibraryState = {
  cards: Card[];
  statuses: string[];
  topicOrder: string[];
  categoryOrder: CategoryOrder;
  collectionCategories: Record<CategoryCollection, string[]>;
};
const collections = ["author", "journal", "note"] as const;
type Change<Value> = { before?: Value; after?: Value };
type ListChange = { before: string[]; after: string[] };

export type DesktopSnapshot = { revision: number; json: string | null };
export type DesktopSaveResult = { revision: number; reconcile: boolean } | { missing: number[] };

function withDrafts<State extends LibraryState>(state: State, drafts: Map<number, State["cards"][number]>): State {
  if (!drafts.size) return state;
  return { ...state, cards: state.cards.map(card => drafts.get(card.id) ?? card) };
}

function libraryChanges(before: LibraryState | null, after: LibraryState) {
  const added: Card[] = [];
  const removed: Card[] = [];
  const updated: { id: number; fields: ({ key: string } & Change<unknown>)[] }[] = [];
  if (before?.cards !== after.cards) {
    const remaining = new Map(before?.cards.map(card => [card.id, card]));
    for (const card of after.cards) {
      const previous = remaining.get(card.id);
      remaining.delete(card.id);
      if (!previous) added.push(card);
      else if (previous !== card) {
        const prior = previous as Record<string, unknown>;
        const next = card as Record<string, unknown>;
        const keys = new Set([...Object.keys(prior), ...Object.keys(next)]);
        const fields = [...keys].filter(key => key !== "id" && prior[key] !== next[key])
          .map(key => ({ key, before: prior[key], after: next[key] }));
        if (fields.length) updated.push({ id: card.id, fields });
      }
    }
    removed.push(...remaining.values());
  }
  const listChange = (before: string[] | undefined, after: string[]): ListChange | undefined =>
    before === after ? undefined : { before: before || [], after };
  const statuses = listChange(before?.statuses, after.statuses);
  const topicOrder = listChange(before?.topicOrder, after.topicOrder);
  const collectionCategories = Object.fromEntries(collections.flatMap(kind => {
    const change = listChange(before?.collectionCategories[kind], after.collectionCategories[kind]);
    return change ? [[kind, change]] : [];
  }));
  const categoryOrder = Object.fromEntries((["paper", ...collections] as const).flatMap(kind => {
    const change = listChange(before?.categoryOrder[kind], after.categoryOrder[kind]);
    return change ? [[kind, change]] : [];
  }));
  if (!added.length && !removed.length && !updated.length && !statuses && !topicOrder &&
      !Object.keys(collectionCategories).length && !Object.keys(categoryOrder).length) return null;
  return { added, removed, updated, statuses, topicOrder, collectionCategories, categoryOrder };
}

async function stringifyOffThread(value: unknown): Promise<string> {
  if (typeof Worker === "undefined") return JSON.stringify(value);
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
        worker.postMessage(value);
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
  const adopting = useRef<State | null>(null);
  const revision = useRef(0);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapshotRevision = useCallback(() => revision.current, []);
  const adoptSnapshot = useCallback((state: State, version: number) => {
    adopting.current = state;
    revision.current = version;
  }, []);

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
            const changes = libraryChanges(saved.current, next);
            if (changes) {
              const baseRevision = revision.current;
              const recoveryIds = new Set<number>();
              let result: DesktopSaveResult;
              for (;;) {
                const recover = recoveryIds.size ? next.cards.filter(card => recoveryIds.has(card.id)) : [];
                result = await desktop.saveCards(await stringifyOffThread({ baseRevision, changes, recover }));
                if ("revision" in result) break;
                const previous = recoveryIds.size;
                result.missing.forEach(id => recoveryIds.add(id));
                if (recoveryIds.size === previous) throw new Error("The shared library could not recover a changed card.");
              }
              if (!result.reconcile) revision.current = result.revision;
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
    if (adopting.current?.cards === state.cards && adopting.current.statuses === state.statuses &&
        adopting.current.topicOrder === state.topicOrder && adopting.current.collectionCategories === state.collectionCategories &&
        adopting.current.categoryOrder === state.categoryOrder) {
      adopting.current = null;
      saved.current = state;
    }
    if (drafts.current.size) {
      for (const card of state.cards) if (drafts.current.get(card.id) === card) drafts.current.delete(card.id);
    }
    latest.current = withDrafts(state, drafts.current);
  }, [state, ready]);

  useEffect(() => {
    if (!ready) return;
    if (latest.current === saved.current) setStatus("saved");
    else schedule();
  }, [state, ready, schedule]);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  const hasUnsaved = useCallback(() => !!inFlight.current || latest.current !== saved.current, []);
  return { status, saveNow, stageCard, stagedCard, discardStagedCards, hasUnsaved, adoptSnapshot, snapshotRevision };
}
