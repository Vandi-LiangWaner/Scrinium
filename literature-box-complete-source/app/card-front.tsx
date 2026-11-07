import type { MouseEvent } from "react";
import type { Figure } from "./figures";

export function hasCardSelection(card: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return false;
  return selection.getRangeAt(0).intersectsNode(card);
}

export function isSelectingCardText(allowCollapsed = false) {
  const selection = window.getSelection();
  const anchor = selection?.anchorNode;
  const element = anchor instanceof Element ? anchor : anchor?.parentElement;
  const card = element?.closest<HTMLElement>(".deck-card");
  return !!card && (allowCollapsed || hasCardSelection(card));
}

/** Text gestures belong to selection; only the surrounding paper opens a card. */
export function isCardTextInteraction(event: MouseEvent<HTMLElement>) {
  if (event.defaultPrevented || hasCardSelection(event.currentTarget)) return true;
  const target = event.target;
  return target instanceof Element && !!target.closest(
    "h2, p, button, a, input, textarea, select, .status-dot, .card-number, .journal-summary, .finding, .preview-details, .search-matches, footer span",
  );
}

export function CardDragHandle({ id }: { id: number }) {
  return <button type="button" className="card-drag-handle" draggable aria-label="Drag card"
    title="Drag this handle to a category or topic" onClick={event => event.stopPropagation()}
    onDragStart={event => {
      event.stopPropagation();
      event.dataTransfer.setData("text/plain", String(id));
      event.dataTransfer.setData("application/x-scrinium-card", String(id));
      event.dataTransfer.effectAllowed = "move";
    }}>⠿</button>;
}

export function CardThumbnails({ figures, onPreview }: { figures: Figure[]; onPreview: (id: number) => void }) {
  if (!figures.length) return null;
  return <div className="card-thumbs" aria-label="Card figures">
    {figures.slice(0, 3).map((image, index) => <button type="button" key={image.id}
      aria-label={`Enlarge ${image.name}`} onClick={event => { event.stopPropagation(); onPreview(image.id); }}
      style={{ transform: `rotate(${index % 2 ? 2 : -2}deg)` }}>
      <img src={image.data} alt={image.name} draggable={false}/>
    </button>)}
    {figures.length > 3 && <em>+{figures.length - 3}</em>}
  </div>;
}
