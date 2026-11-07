import { memo, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { useFlipRepeat } from "./flip-button";

const StackPile = memo(function StackPile({ count, behind, expanded, onFlip }: {
  count: number; behind: boolean; expanded: boolean; onFlip: (duration?: number) => void;
}) {
  const shown = Math.min(behind ? 12 : 10, count);
  return <button type="button" className={`card-pile card-pile-${behind ? "next" : "previous"}`}
    disabled={!count || expanded} aria-label={`Hold ${behind ? "rear" : "front"} cards to browse ${behind ? "forward" : "backward"}. ${count} cards.`}
    onClick={event => { if (event.detail === 0) onFlip(); }}>
    {Array.from({ length: shown }, (_, index) => <span key={index} className="stack-paper"
      style={{ transform: `translateZ(${(index + 1) * 18 * (behind ? -1.4 : 1)}px) rotateX(${behind ? 28 : -78}deg)` } as CSSProperties}>
      <span className="stack-paper-face"/><span className="stack-paper-face stack-paper-back"/>
      <span className="stack-paper-rim stack-paper-left"/><span className="stack-paper-rim stack-paper-right"/>
    </span>)}
  </button>;
});

/** One camera projects every full-sized sheet, including both sides of a flipping card. */
export function StackStage({ expanded, position, total, onNext, onPrevious, fromBounds, children }: {
  expanded: boolean; position: number; total: number;
  onNext: (duration?: number) => void; onPrevious: (duration?: number) => void;
  fromBounds: RefObject<DOMRect | null>; children: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const transition = useRef<HTMLDivElement>(null);
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
      element.style.height = expanded ? "706px" : `${900 * width / 1000}px`;
    };
    resize();
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(resize); });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [expanded]);
  useLayoutEffect(stop, [expanded, stop]);
  useLayoutEffect(() => {
    const before = fromBounds.current;
    fromBounds.current = null;
    const frame = transition.current;
    const card = viewport.current?.querySelector("[data-stack-layer=active]");
    if (!before || !frame || !card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const after = card.getBoundingClientRect();
    const origin = frame.getBoundingClientRect();
    if (!after.width || !after.height) return;
    const sx = before.width / after.width, sy = before.height / after.height;
    const dx = before.left - origin.left - (after.left - origin.left) * sx;
    const dy = before.top - origin.top - (after.top - origin.top) * sy;
    // Only the transition is scaled. Its finished state leaves the reading card in native layout.
    const animation = frame.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
      { transform: "none" },
    ], { duration: 320, easing: "cubic-bezier(.2,.7,.25,1)" });
    animation.finished.catch(() => {});
    return () => animation.cancel();
  }, [expanded, fromBounds]);
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
    <div ref={transition} className="stack-transition"><div className="stack-projection"><div className="stack-world">
      <StackPile count={Math.max(0, total - position - 1)} behind expanded={expanded} onFlip={onNext}/>
      {children}
      <StackPile count={position} behind={false} expanded={expanded} onFlip={onPrevious}/>
    </div></div></div>
  </div>;
}
