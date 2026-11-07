import { useEffect, useRef, useState, type ReactNode } from "react";

export type Figure = { id: number; name: string; data: string; caption?: string };

export function FigureGrid({ figures, onPreview, onMove, onRemove, renderCaption }: {
  figures: Figure[];
  onPreview: (id: number) => void;
  onMove: (sourceId: number, targetId: number) => void;
  onRemove: (id: number) => void;
  renderCaption: (figure: Figure, index: number) => ReactNode;
}) {
  const dragId = useRef<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  return <div className="image-grid">
    {figures.map((figure, index) => <figure key={figure.id} className={target === figure.id ? "figure-drop-target" : ""} onDragOver={event => {
      if (dragId.current === null || dragId.current === figure.id) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setTarget(figure.id);
    }} onDrop={event => {
      if (dragId.current === null) return;
      event.preventDefault();
      onMove(dragId.current, figure.id);
      setTarget(null);
      dragId.current = null;
    }}>
      <div className="figure-actions">
        <button type="button" className="figure-drag" draggable aria-label={`Reorder figure ${index + 1}`} title="Drag to reorder or use Alt + arrow keys" onDragStart={event => {
          dragId.current = figure.id;
          event.dataTransfer.setData("application/x-literature-box-figure", String(figure.id));
          event.dataTransfer.effectAllowed = "move";
          const thumbnail = event.currentTarget.closest("figure")?.querySelector("img");
          if (thumbnail) event.dataTransfer.setDragImage(thumbnail, 30, 30);
        }} onDragEnd={() => { dragId.current = null; setTarget(null); }} onKeyDown={event => {
          if (!event.altKey) return;
          const offset = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
          if (!offset) return;
          event.preventDefault();
          const neighbor = figures[index + offset];
          if (neighbor) onMove(figure.id, neighbor.id);
        }}>⠿</button>
        <span>Figure {index + 1}</span>
        <button type="button" className="figure-remove" aria-label={`Remove ${figure.name}`} onClick={() => onRemove(figure.id)}>×</button>
      </div>
      <button type="button" className="figure-enlarge" onClick={() => onPreview(figure.id)} aria-label={`Enlarge ${figure.name}`}>
        <img className="zoomable-image" src={figure.data} alt={figure.name} draggable={false} loading="lazy"/>
      </button>
      <figcaption>
        <span title={figure.name}>{figure.name}</span>
        {renderCaption(figure, index)}
      </figcaption>
    </figure>)}
  </div>;
}

export function FigureLightbox({ figures, selected, onSelect, onClose }: {
  figures: Figure[];
  selected: number;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const index = figures.findIndex(figure => figure.id === selected);
  const figure = figures[index];
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  if (!figure) return null;
  const move = (offset: number) => onSelect(figures[(index + offset + figures.length) % figures.length].id);
  return <dialog ref={dialog} className="figure-lightbox" aria-label="Figure viewer" onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }} onClick={event => {
    if (event.target === event.currentTarget) onClose();
  }} onKeyDown={event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      move(event.key === "ArrowLeft" ? -1 : 1);
    }
  }}>
    <button className="figure-lightbox-close" type="button" aria-label="Close image" autoFocus onClick={onClose}>×</button>
    <figure>
      <img src={figure.data} alt={figure.name}/>
      <figcaption><strong>{figure.name}</strong>{figure.caption && <p>{figure.caption}</p>}</figcaption>
    </figure>
    <div className="figure-navigation">
      <button type="button" aria-label="Previous figure" disabled={figures.length < 2} onClick={() => move(-1)}>← Previous</button>
      <span aria-live="polite">{index + 1} of {figures.length}</span>
      <button type="button" aria-label="Next figure" disabled={figures.length < 2} onClick={() => move(1)}>Next →</button>
    </div>
  </dialog>;
}
