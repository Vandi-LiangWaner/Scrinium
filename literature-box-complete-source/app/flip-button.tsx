import { useCallback, useEffect, useRef, type ReactNode } from "react";

const HOLD_DELAY_MS = 250;
export const FLIP_INTERVAL_MS = 160;

export function FlipButton({ label, className, disabled, onFlip, children }: {
  label: string;
  className: string;
  disabled?: boolean;
  onFlip: () => void;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);
  const onFlipRef = useRef(onFlip);
  useEffect(() => { onFlipRef.current = onFlip; }, [onFlip]);

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => {
    if (disabled) stop();
    window.addEventListener("blur", stop);
    return () => {
      stop();
      window.removeEventListener("blur", stop);
    };
  }, [disabled, stop]);

  return <button type="button" aria-label={label} className={className} disabled={disabled}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return;
      repeated.current = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      stop();
      const repeat = () => {
        repeated.current = true;
        onFlipRef.current();
        timer.current = setTimeout(repeat, FLIP_INTERVAL_MS);
      };
      timer.current = setTimeout(repeat, HOLD_DELAY_MS);
    }}
    onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
    onClick={event => {
      if (event.detail === 0 || !repeated.current) onFlip();
      repeated.current = false;
    }}>{children}</button>;
}
