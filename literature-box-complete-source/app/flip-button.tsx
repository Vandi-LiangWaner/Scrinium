import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const FLIP_INTERVAL_MS = 280;

export function useFlipRepeat() {
  const frame = useRef<number | null>(null);
  const stop = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const start = useCallback((step: () => void) => {
    stop();
    let nextStep = performance.now() + FLIP_INTERVAL_MS;
    const advance = (now: number) => {
      frame.current = requestAnimationFrame(advance);
      if (now < nextStep) return;
      nextStep = Math.max(nextStep + FLIP_INTERVAL_MS, now + FLIP_INTERVAL_MS / 2);
      step();
    };
    frame.current = requestAnimationFrame(advance);
    step();
  }, [stop]);
  useEffect(() => {
    window.addEventListener("blur", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
    };
  }, [stop]);
  return { start, stop };
}

export function FlipButton({ label, className, disabled, onFlip, children, style }: {
  label: string;
  className: string;
  disabled?: boolean;
  onFlip: () => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { start, stop } = useFlipRepeat();
  const onFlipRef = useRef(onFlip);
  useEffect(() => { onFlipRef.current = onFlip; }, [onFlip]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  return <button type="button" aria-label={label} className={className} disabled={disabled} style={style}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start(() => onFlipRef.current());
    }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onClick={event => {
      if (event.detail === 0) onFlip();
    }}>{children}</button>;
}
