import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useFlipRepeat } from "./flip-button";

const StackPile = memo(function StackPile({ count, behind, expanded, onFlip }: {
  count: number; behind: boolean; expanded: boolean; onFlip: (duration?: number) => void;
}) {
  const shown = Math.min(behind ? 40 : 28, count);
  return <button type="button" className={`card-pile card-pile-${behind ? "next" : "previous"}`}
    disabled={!count || expanded} aria-label={`Hold ${behind ? "rear" : "front"} cards to browse ${behind ? "forward" : "backward"}. ${count} cards.`}
    onClick={event => { if (event.detail === 0) onFlip(); }}>
    {Array.from({ length: shown }, (_, index) => <span key={index} className="stack-paper"
      style={{ transform: `translateZ(${(index + 1) * 9 * (behind ? -1.4 : 1)}px) rotateX(${behind ? 28 : -78}deg)` } as CSSProperties}>
      <span className="stack-paper-face"/><span className="stack-paper-face stack-paper-back"/>
    </span>)}
  </button>;
});

/** One camera projects every full-sized sheet, including both sides of a flipping card. */
export function StackStage({ expanded, position, total, onNext, onPrevious, children }: {
  expanded: boolean; position: number; total: number;
  onNext: (duration?: number) => void; onPrevious: (duration?: number) => void; children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const { start, stop } = useFlipRepeat();
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let lastWidth = 0;
    let frame = 0;
    const resize = () => {
      const width = element.clientWidth;
      if (!width || width === lastWidth) return;
      lastWidth = width;
      element.style.setProperty("--stack-zoom", String(width / 1000));
      element.style.height = `${900 * width / 1000}px`;
    };
    resize();
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(resize); });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  useLayoutEffect(stop, [expanded, stop]);
  return <div ref={viewport} className={`stack-viewport${expanded ? " is-expanded" : ""}`}
    onPointerDown={event => {
      if (expanded || event.button !== 0 || !event.isPrimary) return;
      const target = event.target as HTMLElement;
      let pile = target.closest<HTMLButtonElement>(".card-pile");
      // Chromium can hit the world plane where a preserved-3D sheet protrudes past its button.
      if (!pile && !target.closest(".deck-card")) {
        const card = event.currentTarget.querySelector("[data-stack-layer=active]")?.getBoundingClientRect();
        const direction = card && (event.clientY < card.top ? "next" : event.clientY > card.bottom ? "previous" : null);
        const candidate = direction && event.currentTarget.querySelector<HTMLButtonElement>(`.card-pile-${direction}`);
        if (candidate && [...candidate.children].some(sheet => {
          const rect = sheet.getBoundingClientRect();
          return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        })) pile = candidate;
      }
      if (!pile || pile.disabled) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const step = pile.classList.contains("card-pile-next") ? onNext : onPrevious;
      start(() => step(90));
    }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
    <div className="stack-projection"><div className="stack-world">
      <StackPile count={Math.max(0, total - position - 1)} behind expanded={expanded} onFlip={onNext}/>
      {children}
      <StackPile count={position} behind={false} expanded={expanded} onFlip={onPrevious}/>
    </div></div>
  </div>;
}
