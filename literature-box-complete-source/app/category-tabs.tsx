import { useState } from "react";

export type CategoryOrder = Record<"paper" | "author" | "journal" | "note", string[]>;
const collections = ["paper", "author", "journal", "note"] as const;
const dragType = "application/x-scrinium-category-tab";
export const emptyCategoryOrder = (): CategoryOrder => ({ paper: [], author: [], journal: [], note: [] });
export function restoreCategoryOrder(value: unknown): CategoryOrder {
  const source = value as Partial<CategoryOrder> | null;
  return Object.fromEntries(collections.map(kind => [kind, Array.isArray(source?.[kind])
    ? [...new Set(source[kind]!.filter(id => typeof id === "string"))] : []])) as CategoryOrder;
}
type Tab = { id: string; label: string; filter: string; count: number; category?: string };

export function CategoryTabs({ collection, categories, order, selected, total, unfiled, count, onSelect, onOrder, onDropCard, onEdit }: {
  collection: keyof CategoryOrder; categories: string[]; order: string[]; selected: string; total: number; unfiled: number;
  count: (category: string) => number; onSelect: (filter: string) => void;
  onOrder: (ids: string[]) => void; onDropCard: (id: number, category: string) => void; onEdit: () => void;
}) {
  const tabs: Tab[] = [
    { id: "all", label: "All cards", filter: "All cards", count: total },
    { id: "uncategorized", label: "Without category", filter: "Without category", count: unfiled },
    ...categories.map(category => ({ id: `category:${category.toLowerCase()}`, label: category,
      filter: `category:${category.toLowerCase()}`, count: count(category), category })),
  ];
  const rank = new Map(order.map((id, index) => [id, index]));
  tabs.sort((a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length));
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  function move(id: string, target: string, after: boolean) {
    if (id === target || !tabs.some(tab => tab.id === id)) return;
    const ids = tabs.map(tab => tab.id).filter(value => value !== id);
    const at = ids.indexOf(target);
    if (at < 0) return;
    ids.splice(at + (after ? 1 : 0), 0, id);
    if (ids.every((value, index) => value === tabs[index].id)) return;
    onOrder(ids);
    setAnnouncement(`${tabs.find(tab => tab.id === id)?.label} moved to position ${ids.indexOf(id) + 1} of ${ids.length}.`);
  }
  return <nav className="dividers value-tabs" aria-label="Card categories">
    {tabs.map((tab, index) => <button type="button" key={tab.id} draggable
      className={`category-tab${selected === tab.filter ? " active" : ""}`}
      data-category-tab={tab.id} data-drop-edge={drop?.id === tab.id ? drop.after ? "after" : "before" : undefined}
      aria-description="Drag to reorder, or use Alt + Left or Right."
      onClick={() => onSelect(tab.filter)}
      onKeyDown={event => {
        if (!event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const after = event.key === "ArrowRight", neighbor = tabs[index + (after ? 1 : -1)];
        if (neighbor) move(tab.id, neighbor.id, after);
      }}
      onDragStart={event => {
        event.dataTransfer.setData(dragType, JSON.stringify({ collection, id: tab.id }));
        event.dataTransfer.effectAllowed = "move";
        event.currentTarget.classList.add("is-dragging");
      }}
      onDragEnd={event => { setDrop(null); event.currentTarget.classList.remove("is-dragging"); }}
      onDragOver={event => {
        if (event.dataTransfer.types.includes(dragType)) {
          event.preventDefault(); event.dataTransfer.dropEffect = "move";
          const rect = event.currentTarget.getBoundingClientRect(), after = event.clientX > rect.left + rect.width / 2;
          setDrop(current => current?.id === tab.id && current.after === after ? current : { id: tab.id, after });
        } else if (tab.category && event.dataTransfer.types.includes("text/plain")) event.preventDefault();
      }}
      onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDrop(null); }}
      onDrop={event => {
        event.preventDefault(); setDrop(null);
        const payload = event.dataTransfer.getData(dragType);
        if (payload) {
          try {
            const source = JSON.parse(payload);
            if (source.collection === collection && typeof source.id === "string") {
              const rect = event.currentTarget.getBoundingClientRect();
              move(source.id, tab.id, event.clientX > rect.left + rect.width / 2);
            }
          } catch { /* Ignore unrelated or malformed drag payloads. */ }
        } else if (tab.category) {
          const id = Number(event.dataTransfer.getData("text/plain"));
          if (Number.isFinite(id) && id > 0) onDropCard(id, tab.category);
        }
      }}><span>{tab.label}</span><em>{tab.count}</em></button>)}
    <button type="button" className="edit-statuses" onClick={onEdit}>＋ Edit categories</button>
    <span className="category-order-status" role="status" aria-live="polite">{announcement}</span>
  </nav>;
}
