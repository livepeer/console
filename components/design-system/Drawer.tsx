"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DrawerProps {
  /** Optional id for the dialog element (for aria-controls from the trigger). */
  id?: string;
  open: boolean;
  onClose: () => void;
  /** Optional title rendered in a sticky header row with a close button. */
  title?: string;
  /** aria-label when no title is provided. */
  ariaLabel?: string;
  /** Which edge the drawer slides in from. Defaults to "bottom". */
  side?: "bottom" | "left";
  children: ReactNode;
}

/**
 * Drawer — slides in from the bottom (default) or left with a backdrop.
 * Vaul/shadcn-inspired but dependency-free.
 *
 * - ESC and backdrop tap dismiss
 * - Body scroll lock while open
 * - Portal-rendered to document.body so stacking contexts never trap it
 * - Bottom sheet: max-h-[85vh] + safe-area bottom padding + drag handle
 * - Left sheet: w-[min(280px,80vw)] full-height, no drag handle
 */
export default function Drawer({
  id,
  open,
  onClose,
  title,
  ariaLabel,
  side = "bottom",
  children,
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Focus management: remember the active element on open, restore on close.
  // Also move focus into the panel so screen readers and keyboard users land here.
  useEffect(() => {
    if (open) {
      previousActiveRef.current = document.activeElement as HTMLElement | null;
      // Wait a tick so the panel is fully mounted & visible before focusing.
      requestAnimationFrame(() => panelRef.current?.focus());
    } else if (previousActiveRef.current) {
      previousActiveRef.current.focus?.();
      previousActiveRef.current = null;
    }
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] ${open ? "visible" : "invisible"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close drawer"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || ariaLabel}
        tabIndex={-1}
        className={
          side === "left"
            ? `absolute bottom-0 left-0 top-0 flex w-[min(280px,80vw)] flex-col overflow-hidden rounded-r-2xl border-r border-white/10 bg-dark shadow-2xl shadow-black/60 outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                open ? "translate-x-0" : "-translate-x-full"
              }`
            : `absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-2xl border-t border-white/10 bg-dark shadow-2xl shadow-black/60 outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
                open ? "translate-y-0" : "translate-y-full"
              }`
        }
      >
        {/* Drag handle — bottom sheet only */}
        {side === "bottom" && (
          <div className="flex shrink-0 justify-center pb-1 pt-2">
            <div className="h-1 w-10 rounded-full bg-white/20" />
          </div>
        )}

        {/* Optional header */}
        {title && (
          <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <h2 className="text-sm font-medium text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Scrollable content */}
        <div
          className={
            side === "left"
              ? "flex-1 overflow-y-auto"
              : "flex-1 overflow-y-auto pb-[max(env(safe-area-inset-bottom),1rem)]"
          }
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
