"use client";

import { useEffect, useState } from "react";

/**
 * Returns a clock (ms) that re-renders once a second **only while `active`** —
 * used so a live, in-progress call's elapsed time ticks. No timer runs when
 * everything on screen is terminal, so idle lists cost nothing.
 */
export function useTickWhileActive(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return nowMs;
}
