"use client";

import { Check, Minus } from "lucide-react";
import { useEffect, useRef } from "react";

interface CheckboxProps {
  checked: boolean | "indeterminate";
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
}

/**
 * Checkbox — branded check primitive.
 *
 * Visual: 16px square with branded green-bright fill when checked. Indeterminate
 * state shows a horizontal line (lucide `Minus`) — useful for "select all" rows
 * where some children are checked.
 *
 * Implementation: visually rendered with a custom div, but a real
 * `<input type="checkbox">` lives behind it for native form/keyboard support.
 */
export default function Checkbox({
  checked,
  onChange,
  label,
  disabled = false,
  ariaLabel,
  id,
  className = "",
}: CheckboxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isIndeterminate = checked === "indeterminate";
  const isChecked = checked === true;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const box = (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        ref={inputRef}
        id={id}
        type="checkbox"
        checked={isChecked}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-green-bright/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-dark ${
          isChecked || isIndeterminate
            ? "border-green-bright bg-green-bright"
            : "border-strong bg-white/[0.04] peer-hover:border-white/30"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        {isIndeterminate ? (
          <Minus className="h-3 w-3 text-dark" strokeWidth={3} />
        ) : isChecked ? (
          <Check className="h-3 w-3 text-dark" strokeWidth={3} />
        ) : null}
      </span>
    </span>
  );

  if (!label) return box;

  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer items-center gap-2.5 ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
    >
      {box}
      <span className="text-sm text-fg-strong select-none">{label}</span>
    </label>
  );
}
