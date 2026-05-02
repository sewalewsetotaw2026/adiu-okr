import { useEffect, useRef, useState } from "react";

/**
 * Ensures a boolean flag stays true for at least `minDurationMs` once it becomes true.
 * Useful for loading UIs so they don't flash and can complete one animation cycle.
 */
export default function useMinimumDelay(
  value: boolean,
  minDurationMs: number
): boolean {
  const [delayedValue, setDelayedValue] = useState(value);
  const startTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (value) {
      startTimeRef.current = Date.now();
      setDelayedValue(true);
      return;
    }

    const start = startTimeRef.current;
    if (!start) {
      setDelayedValue(false);
      return;
    }

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, minDurationMs - elapsed);

    timeoutRef.current = window.setTimeout(() => {
      setDelayedValue(false);
      timeoutRef.current = null;
      startTimeRef.current = null;
    }, remaining);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, minDurationMs]);

  return delayedValue;
}
