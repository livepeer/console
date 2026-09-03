import { ReactNode, AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "white" | "ghost" | "accent";
type Size = "xs" | "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-outline",
  /** Kept for callers that predate `primary` becoming neutral — same recipe. */
  white: "btn-primary disabled:cursor-not-allowed disabled:opacity-30",
  ghost: "text-foreground/70 hover:text-foreground hover:bg-foreground/5",
  /** Green fill. Reserved — see the accent rule in CLAUDE.md before using. */
  accent: "btn-accent",
};

const sizeStyles: Record<Size, string> = {
  /** Console chrome — page-header and panel actions. */
  xs: "h-[26px] px-2.5 text-[12px] rounded-[4px]",
  sm: "px-3.5 py-1.5 text-xs rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-lg",
  lg: "px-6 py-3 text-sm rounded-lg",
};

type BaseProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

type AsLink = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };
type AsButton = BaseProps & ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button(props: AsLink | AsButton) {
  const {
    variant = "primary",
    size = "md",
    children,
    className = "",
    ...rest
  } = props;
  const base = `inline-flex items-center justify-center gap-2 select-none font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  if ("href" in rest) {
    return (
      <a
        className={base}
        {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      className={base}
      {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
