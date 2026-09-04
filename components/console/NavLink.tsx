"use client";

import Link from "next/link";

interface NavLinkProps {
  href: string;
  label: string;
  active?: boolean;
  external?: boolean;
  onNavigate?: () => void;
  variant?: "default" | "mobile";
}

export default function NavLink({
  href,
  label,
  active = false,
  external = false,
  onNavigate,
  variant = "default",
}: NavLinkProps) {
  const mobile = variant === "mobile";
  const base = mobile
    ? "inline-flex w-auto items-center rounded-sm px-1 py-1.5 text-4xl font-light leading-none tracking-tight transition-colors"
    : "inline-flex h-7 w-auto items-center rounded-sm px-2 text-ui-body transition-colors";
  const state = mobile
    ? active
      ? "text-foreground"
      : "text-muted-foreground"
    : active
      ? "bg-foreground/3 text-foreground"
      : "text-muted-foreground hover:bg-foreground/3 hover:text-foreground";
  const className = `${base} ${state}`;

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={className}
      onClick={onNavigate}
    >
      {label}
    </Link>
  );
}
