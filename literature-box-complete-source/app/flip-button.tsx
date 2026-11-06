import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";

const FLIP_INTERVAL_MS = 280;

export function useFlipRepeat() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback((step: () => void) => {
    stop();
    step();
    timer.current = setInterval(step, FLIP_INTERVAL_MS);
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
