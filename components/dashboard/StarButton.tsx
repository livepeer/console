"use client";

import { Star } from "lucide-react";
import { useStarredModels } from "@/lib/dashboard/useStarredModels";

type Variant = "overlay" | "inline";

interface StarButtonProps {
  modelId: string;
  variant?: Variant;
  className?: string;
}

export default function StarButton({
  modelId,
  variant = "overlay",
  className = "",
}: StarButtonProps) {
  const { isStarred, toggleStar } = useStarredModels();
  const starred = isStarred(modelId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleStar(modelId);
  };

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={starred}
        aria-label={starred ? "Unstar capability" : "Star capability"}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-bright/40 ${
          starred
            ? "border-warm/30 bg-warm-subtle text-warm"
            : "border-subtle text-fg-strong hover:border-strong hover:bg-hover hover:text-fg"
        } ${className}`}
      >
        <Star
          className={`h-3.5 w-3.5 shrink-0 ${starred ? "fill-warm" : ""}`}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">
          {starred ? "Starred" : "Star"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={starred}
      aria-label={starred ? "Unstar capability" : "Star capability"}
      className={`flex h-6 w-6 items-center justify-center rounded-full bg-overlay backdrop-blur-sm transition-opacity duration-200 hover:bg-overlay focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border-strong)] before:absolute before:-inset-2.5 before:content-[''] ${
        starred
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${className}`}
    >
      <Star
        // Constant `text-white` for the unselected star — this button sits
        // over a `bg-overlay` blur on top of a darkened thumbnail, so we
        // want white in BOTH themes. `text-fg-strong` would render near-
        // black in light mode against the dark blur (illegible).
        className={`h-3 w-3 transition-colors ${
          starred ? "fill-warm text-warm" : "text-white"
        }`}
      />
    </button>
  );
}
