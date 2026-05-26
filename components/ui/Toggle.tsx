"use client";

import { motion } from "framer-motion";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** When true, label sits to the left of the switch. Default false (label right). */
  labelLeft?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  id?: string;
}

/**
 * Toggle — iOS-style switch with branded green-bright when on.
 *
 * Track height 22px; thumb 18px (iOS proportions). The thumb slides via
 * `motion.div` so the transition reads as physical, not just a color shift.
 * Used for boolean settings (e.g. notifications on/off).
 */
export default function Toggle({
  checked,
  onChange,
  label,
  labelLeft = false,
  disabled = false,
  ariaLabel,
  className = "",
  id,
}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) onChange(!checked);
  };

  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? label}
      disabled={disabled}
      onClick={handleClick}
      id={id}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/50 focus-visible:ring-offset-2 focus-visible:ring-offset-dark disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-green-bright" : "bg-white/[0.10]"
      }`}
    >
      <motion.span
        aria-hidden="true"
        animate={{ x: checked ? 18 : 2 }}
        transition={{ type: "spring", stiffness: 600, damping: 36, mass: 0.5 }}
        className="block h-[18px] w-[18px] rounded-full bg-white shadow-md shadow-black/20"
      />
    </button>
  );

  if (!label) return switchEl;

  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer items-center gap-3 ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
    >
      {labelLeft && <span className="text-sm text-fg-strong">{label}</span>}
      {switchEl}
      {!labelLeft && <span className="text-sm text-fg-strong">{label}</span>}
    </label>
  );
}
