"use client";

import { Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  /** Visual size — `sm` (default, compact), `md` (toolbar), or `lg` (chunky, app-shell). */
  size?: "sm" | "md" | "lg";
}

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search",
  ariaLabel = "Search",
  className = "",
  size = "sm",
}: SearchInputProps) {
  const inputCls =
    size === "lg"
      ? "w-full rounded-lg border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm h-11 pl-10 pr-10 text-sm text-white placeholder:text-white/35 transition-all duration-150 hover:border-white/20 focus:bg-white/[0.06] focus:border-white/30 focus:ring-1 focus:ring-green-bright/30 focus:outline-none"
      : size === "md"
        ? "w-full rounded-lg border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm h-9 lg:h-8 pl-9 lg:pl-8 pr-9 text-xs text-white placeholder:text-white/35 transition-all duration-150 hover:border-white/20 focus:bg-white/[0.06] focus:border-white/30 focus:ring-1 focus:ring-green-bright/30 focus:outline-none"
        : "w-full rounded-md border border-white/[0.10] bg-white/[0.04] backdrop-blur-sm py-[5px] pl-9 pr-8 text-xs text-white/70 placeholder:text-white/30 transition-all duration-150 hover:border-white/20 focus:bg-white/[0.06] focus:border-white/30 focus:ring-1 focus:ring-green-bright/30 focus:outline-none select-none";
  const iconCls =
    size === "sm"
      ? "pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-white/50"
      : "pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-white/40";
  const clearCls =
    size === "sm"
      ? "absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-white/50 transition-colors hover:text-white/80"
      : "absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-white/40 transition-colors hover:text-white/80";

  return (
    <div className={`relative ${className}`}>
      <Search className={iconCls} />
      <input
        type="text"
        placeholder={placeholder}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      <AnimatePresence>
        {value && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.2 } }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            onClick={() => onChange("")}
            className={clearCls}
            aria-label="Clear search"
          >
            <svg
              width={size === "sm" ? "20" : "18"}
              height={size === "sm" ? "20" : "18"}
              viewBox="0 0 20 20"
              fill="none"
              className="block"
            >
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
