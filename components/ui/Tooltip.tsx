"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Content rendered inside the floating tooltip. */
  content: ReactNode;
  /**
   * Single child that becomes the trigger. Tooltip wires up `aria-describedby`,
   * `onMouseEnter/Leave`, `onFocus/Blur` to the child element directly so the
   * trigger keeps its own focus ring and styling.
   */
  children: ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    "aria-describedby"?: string;
  }>;
  /** Which side of the trigger the tooltip appears on. Default `top`. */
  side?: Side;
  /** Open delay (ms) when triggered by hover. Keyboard focus opens immediately. Default 200. */
  delayMs?: number;
  /** Optional className applied to the floating panel. */
  className?: string;
}

const SIDE_POSITION: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const SIDE_ORIGIN: Record<Side, string> = {
  top: "origin-bottom",
  bottom: "origin-top",
  left: "origin-right",
  right: "origin-left",
};

/**
 * Tooltip — branded floating tooltip with hover + focus triggers.
 *
 * Replaces native `title=` attributes (which look like default browser
 * tooltips) and the hand-rolled hover-tooltip in `NetworkStatusDot`.
 *
 * Accessibility:
 *  - Wraps a single child trigger and binds `aria-describedby` to it
 *  - Opens on `mouseenter` after a delay, on `focus` immediately
 *  - Closes on `mouseleave`, `blur`, and `Escape`
 *
 * Positioning is CSS-based (no Floating UI). For surfaces that risk overflow
 * (e.g. tooltips near viewport edges), pass `side` explicitly.
 */
export default function Tooltip({
  content,
  children,
  side = "top",
  delayMs = 200,
  className = "",
}: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const cancelTimer = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => () => cancelTimer(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const child = Children.only(children);
  if (!isValidElement(child)) return child;

  const handleEnter = () => {
    cancelTimer();
    timeoutRef.current = window.setTimeout(() => setOpen(true), delayMs);
  };
  const handleLeave = () => {
    cancelTimer();
    setOpen(false);
  };
  const handleFocus = () => {
    cancelTimer();
    setOpen(true);
  };
  const handleBlur = () => {
    cancelTimer();
    setOpen(false);
  };

  const trigger = cloneElement(child, {
    "aria-describedby": open ? id : undefined,
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e);
      handleEnter();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e);
      handleLeave();
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e);
      handleFocus();
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e);
      handleBlur();
    },
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-subtle bg-dark-card/95 px-2 py-1 text-[11px] font-medium text-fg-strong shadow-lg shadow-black/40 backdrop-blur-md ${SIDE_POSITION[side]} ${SIDE_ORIGIN[side]} ${className}`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
