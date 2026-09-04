export type WaitingState =
  | "pending"
  | "verify-email"
  | "revoked"
  | "disabled"
  | "enrollment-attention"
  | "unavailable";

export const waitingCopy: Record<
  WaitingState,
  { title: string; description: string }
> = {
  "enrollment-attention": {
    title: "We couldn’t finish connecting your waitlist entry.",
    description:
      "Your sign-in worked, but we can’t confirm waitlist enrollment for this account. Please contact the Livepeer team for help. We haven’t changed your email preferences.",
  },
  pending: {
    title: "You’re on the waitlist.",
    description:
      "We’re welcoming people to Livepeer in stages. We’ll email you when your Console access is ready. You don’t need to sign up again.",
  },
  "verify-email": {
    title: "Verify your email to continue.",
    description:
      "Your sign-in provider hasn’t confirmed your email address yet. Verify it with your provider, then sign out and sign in again so we can safely connect your waitlist entry.",
  },
  revoked: {
    title: "Your Console access is paused.",
    description:
      "Your account no longer has early access. Signing in again won’t change that. Please contact the Livepeer team if you think this is a mistake.",
  },
  disabled: {
    title: "Your account is disabled.",
    description:
      "Console access is unavailable for this account. Please contact the Livepeer team for help.",
  },
  unavailable: {
    title: "We can’t check your access right now.",
    description:
      "This doesn’t mean your access was removed. Please try again in a moment. Your sign-in and waitlist membership are separate from this temporary check.",
  },
};

export function WaitingContent({
  state,
  retryHref,
  fromMcp = false,
}: {
  state: WaitingState;
  retryHref: string;
  fromMcp?: boolean;
}) {
  const copy = waitingCopy[state];
  return (
    <main className="dark flex min-h-svh items-center justify-center bg-background px-6 text-foreground">
      <section
        className="w-full max-w-lg py-16 font-sans"
        aria-labelledby="access-title"
      >
        <a href="/waitlist" className="text-sm text-white/60">
          Livepeer · Early access
        </a>
        <h1
          id="access-title"
          className="mt-10 font-display text-4xl font-light tracking-tight"
        >
          {copy.title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-white/65">
          {copy.description}
        </p>
        {fromMcp ? (
          <p className="mt-4 text-sm text-white/65">
            Your agent connection has not been authorized. Once your access is
            ready, restart the connection from your agent.
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-5 text-sm">
          <a
            className="rounded-md bg-white px-4 py-2 text-black"
            href={retryHref}
          >
            Check access again
          </a>
          <a
            className="text-white/70 underline underline-offset-4"
            href="/auth/logout"
          >
            Sign out
          </a>
        </div>
        <p className="mt-8 text-xs leading-relaxed text-white/45">
          Waitlist membership does not subscribe you to marketing emails.
        </p>
      </section>
    </main>
  );
}
