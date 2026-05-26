"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, type LucideIcon } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
};

type BaseProps = {
  options: SelectOption[];
  placeholder?: string;
  size?: "sm" | "md";
  label?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
  triggerClassName?: string;
};

type SingleProps = {
  multiple?: false;
  value: string;
  onChange: (value: string) => void;
};

type MultiProps = {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
  allOptionLabel?: string;
};

export type SelectProps = BaseProps & (SingleProps | MultiProps);

export default function Select(props: SelectProps) {
  const {
    options,
    placeholder = "Select…",
    size = "md",
    label,
    disabled,
    required,
    id,
    className,
    menuClassName,
    ariaLabel,
    triggerClassName,
  } = props;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hasDescription = options.some((o) => o.description);

  const isSelected = (value: string): boolean =>
    props.multiple ? props.value.includes(value) : props.value === value;

  const allCleared = props.multiple && props.value.length === 0;

  const displayText = (() => {
    if (props.multiple) {
      const { value, allOptionLabel } = props;
      if (value.length === 0) return allOptionLabel ?? placeholder;
      if (value.length === 1) {
        return options.find((o) => o.value === value[0])?.label ?? "1 selected";
      }
      return `${value.length} selected`;
    }
    const current = options.find((o) => o.value === props.value);
    return current?.label ?? placeholder;
  })();

  const hasValue = props.multiple
    ? props.value.length > 0
    : Boolean(props.value);

  const handleSelect = (value: string) => {
    if (props.multiple) {
      if (props.value.includes(value)) {
        props.onChange(props.value.filter((v) => v !== value));
      } else {
        props.onChange([...props.value, value]);
      }
    } else {
      props.onChange(value);
      setOpen(false);
    }
  };

  const handleClearAll = () => {
    if (props.multiple) {
      props.onChange([]);
    }
  };

  const triggerSize =
    size === "sm"
      ? "h-9 px-3 text-xs"
      : "px-3 py-2.5 text-sm";

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        data-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-left transition-colors hover:border-white/20 hover:bg-white/[0.05] focus:border-white/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-green-bright/30 disabled:opacity-50 disabled:cursor-not-allowed ${triggerSize} ${triggerClassName ?? ""}`}
      >
        {label && <span className="shrink-0 text-white/40">{label}</span>}
        <span
          className={`min-w-0 truncate ${
            hasValue
              ? size === "sm"
                ? "text-[13px] font-medium text-white/80"
                : "text-white"
              : "text-white/40"
          }`}
        >
          {displayText}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 shrink-0 text-white/40 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel ?? label}
          aria-multiselectable={props.multiple || undefined}
          className={`absolute left-0 top-full z-50 mt-1 min-w-full max-h-60 overflow-auto rounded-lg border border-white/[0.08] bg-dark-card/95 p-1 shadow-lg shadow-black/30 backdrop-blur-xl ${menuClassName ?? ""}`}
        >
          {props.multiple && props.allOptionLabel !== undefined && (
            <>
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={allCleared}
                  onClick={handleClearAll}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                    allCleared
                      ? "bg-white/[0.06] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span>{props.allOptionLabel}</span>
                  {allCleared && (
                    <Check className="h-3.5 w-3.5 text-green-bright" />
                  )}
                </button>
              </li>
              <li aria-hidden="true" className="my-1 h-px bg-white/[0.06]" />
            </>
          )}
          {options.map((opt) => {
            const selected = isSelected(opt.value);
            const Icon = opt.icon;
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                    selected
                      ? "bg-white/[0.06] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {Icon && (
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{opt.label}</p>
                    {opt.description && (
                      <p className="mt-0.5 text-[11px] text-white/45">
                        {opt.description}
                      </p>
                    )}
                  </div>
                  {selected && (
                    <Check
                      className={`shrink-0 text-green-bright ${hasDescription ? "mt-0.5" : ""} h-3.5 w-3.5`}
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
