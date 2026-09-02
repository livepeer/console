"use client";

/**
 * HomeCommandBar — the page masthead: a warm sans-serif greeting.
 *
 * There used to be a mono "system readout" line above it carrying the
 * organization slug (hardcoded to `flipbook`), later the signed-in email. With
 * organizations gone the line had nothing left to report — the email is one
 * click away in the account menu, and the greeting already names the person.
 * Three places on one screen saying who you are is two too many.
 */
export default function HomeCommandBar({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <header>
      <h1 className="text-[28px] font-bold leading-[1.05] tracking-[-0.02em] text-fg">
        {greeting}, {firstName}
      </h1>
    </header>
  );
}
