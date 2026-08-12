import { ReactNode } from "react";

const VARIANT_STYLES = {
  default:
    "rounded-full border-green/30 bg-green-subtle text-green-light px-3 py-1 text-xs",
  category:
    "rounded border-transparent bg-foreground/[0.10] text-foreground/50 px-2.5 py-0.5 text-[11px] uppercase tracking-wide",
  tag: "rounded border-transparent bg-foreground/[0.06] text-foreground/30 px-2.5 py-0.5 text-[11px]",
  // Console-specific tiny pill — used by AppsButton dropdown row chips
  // ("Preview", etc). Smaller than `tag`, tighter type, no uppercase tracking.
  neutral:
    "rounded-full border-transparent bg-foreground/[0.06] text-foreground/40 px-1.5 py-[1px] text-[9px] leading-tight",
} as const;

export default function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANT_STYLES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center border font-mono font-medium ${VARIANT_STYLES[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
