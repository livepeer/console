"use client";

import { useId, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useWaitlistSession } from "./waitlist-session";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Legacy verification confirms an enrollment, never an authenticated session. */
export function LegacyVerificationNotice({
  status,
}: {
  status: "confirmed" | "invalid";
}) {
  const { state, joinHref, onAuthStart } = useWaitlistSession();
  return (
    <aside
      role="status"
      className="fixed top-20 left-1/2 z-[70] w-[min(90vw,32rem)] -translate-x-1/2 rounded-sm border border-white/20 bg-black/85 p-3 text-center text-xs leading-relaxed text-white backdrop-blur"
    >
      <p>
        {status === "confirmed"
          ? "Your legacy waitlist link has been confirmed."
          : "This legacy waitlist link is invalid or expired."}
      </p>
      {state.status !== "signed-in" && (
        <p className="mt-1">
          This link does not sign you in.{" "}
          <a
            href={joinHref}
            onClick={onAuthStart}
            className="font-semibold underline underline-offset-4"
          >
            Sign in securely
          </a>{" "}
          to view or join the waitlist.
        </p>
      )}
    </aside>
  );
}

function ReferralControl({
  compact = false,
  smoothTheme = false,
}: {
  compact?: boolean;
  smoothTheme?: boolean;
}) {
  const { state } = useWaitlistSession();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  if (state.status !== "signed-in") return null;
  const inviteUrl = state.data.member.referralUrl;
  async function copyInviteUrl() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 transition-colors",
        smoothTheme ? "duration-[900ms] ease-in-out" : "duration-100 ease-out"
      )}
    >
      {!compact && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="font-display text-2xl leading-none font-light tracking-tight">
            You’re on the waitlist
          </span>
          <span className="text-[10px] leading-none font-semibold">
            Invite a friend
          </span>
        </div>
      )}
      <div
        role="textbox"
        aria-label="Your referral link"
        aria-readonly="true"
        className={cn(
          "relative inline-flex h-8 w-fit min-w-0 items-center rounded-sm bg-muted px-2.5 pr-9 text-xs transition-colors dark:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]",
          smoothTheme
            ? "duration-[900ms] ease-in-out"
            : "duration-100 ease-out",
          compact ? "max-w-[min(62vw,28rem)]" : "max-w-[min(60vw,22rem)]"
        )}
      >
        <span className="max-w-full truncate">{inviteUrl}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => void copyInviteUrl()}
          aria-label={copied ? "Referral link copied" : "Copy referral link"}
          className="absolute top-0 right-0 rounded-sm"
        >
          {copied ? (
            <CheckIcon className="size-3.5" aria-hidden="true" />
          ) : (
            <CopyIcon className="size-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>
      {copyError && (
        <p role="alert" className="text-xs">
          Couldn’t copy the link. Select and copy it above.
        </p>
      )}
    </div>
  );
}

/** Every signup surface begins the same server-owned Auth0 transaction. */
export function JoinWaitlistControl({
  defaultExpanded = false,
  smoothTheme = false,
}: {
  defaultExpanded?: boolean;
  smoothTheme?: boolean;
  /** Kept for scene compatibility; email-verification dialogs are retired. */
  showVerificationDialog?: boolean;
}) {
  const { state, joinHref, onAuthStart } = useWaitlistSession();
  if (state.status === "signed-in")
    return (
      <ReferralControl compact={!defaultExpanded} smoothTheme={smoothTheme} />
    );
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2.5",
        defaultExpanded && "min-h-20 w-[min(60vw,22rem)]"
      )}
    >
      {defaultExpanded && (
        <span className="text-[10px] leading-none font-semibold">
          Sign up for early access
        </span>
      )}
      <a
        href={joinHref}
        onClick={onAuthStart}
        className={cn(
          buttonVariants({ variant: "muted", size: "sm" }),
          "rounded-sm text-[10px] dark:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]",
          defaultExpanded ? "min-w-40" : "px-3",
          smoothTheme && "duration-[900ms] ease-in-out"
        )}
      >
        Join waitlist
      </a>
      {defaultExpanded && (
        <span className="text-center text-[10px] leading-4 opacity-65">
          Continue with secure sign-in. Email updates are optional.
        </span>
      )}
      {state.status === "error" && defaultExpanded && (
        <p role="alert" className="max-w-xs text-center text-xs">
          {state.message}
        </p>
      )}
    </div>
  );
}

function MembershipDialog({ theme }: { theme: "base" | "inverse" }) {
  const { state, updateNewsletterConsent, consentSaving, consentError } =
    useWaitlistSession();
  const checkboxId = useId();
  if (state.status !== "signed-in") return null;
  const { member } = state.data;
  return (
    <Dialog>
      <DialogTrigger
        render={<button type="button" />}
        className="text-[10px] leading-none font-semibold underline-offset-4 hover:underline"
      >
        Your waitlist
      </DialogTrigger>
      <DialogContent
        className={cn(
          "waitlist-surface max-h-[85svh] overflow-auto rounded-sm",
          theme === "inverse" && "dark"
        )}
      >
        <DialogTitle className="font-display text-2xl">
          Your early-access membership
        </DialogTitle>
        <DialogDescription>
          Your waitlist membership, Console access, and email preferences are
          separate.
        </DialogDescription>
        <p className="break-all text-sm">{member.email}</p>
        <dl className="grid grid-cols-3 gap-3 py-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Position</dt>
            <dd className="mt-1 text-xl">{member.position}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Verified referrals
            </dt>
            <dd className="mt-1 text-xl">{member.referrals.verified}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pending referrals</dt>
            <dd className="mt-1 text-xl">{member.referrals.pending}</dd>
          </div>
        </dl>
        <ReferralControl compact />
        <div className="mt-3 border-t border-border pt-4">
          <label
            htmlFor={checkboxId}
            className="flex items-start gap-3 text-sm"
          >
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-1 accent-current"
              checked={member.newsletterOptIn}
              disabled={consentSaving}
              onChange={(event) =>
                void updateNewsletterConsent(event.target.checked)
              }
            />
            <span>
              Subscribe for product updates
              <span className="mt-1 block text-xs text-muted-foreground">
                Optional marketing emails. This won’t change your place or
                Console approval.
              </span>
            </span>
          </label>
          {consentSaving && (
            <p role="status" className="mt-2 text-xs">
              Saving preference…
            </p>
          )}
          {consentError && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {consentError}
            </p>
          )}
        </div>
        <a href="/login" className="mt-2 text-sm underline underline-offset-4">
          Continue to Console
        </a>
      </DialogContent>
    </Dialog>
  );
}

export function WaitlistHeaderAuth({
  theme = "base",
  smoothTheme = false,
}: {
  theme?: "base" | "inverse";
  /** Media belongs to the existing Auth0/Console branded login, not a second form. */
  signInImage?: { src: string; alt: string };
  smoothTheme?: boolean;
}) {
  const { state, joinHref, onAuthStart, onSignOut } = useWaitlistSession();
  const signedIn = state.status === "signed-in";
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 shrink-0 items-center text-[10px] leading-none font-semibold">
          {signedIn ? "Invite a friend" : "Livepeer Agent Early Access"}
        </span>
        <div className="hidden sm:block">
          <JoinWaitlistControl smoothTheme={smoothTheme} />
        </div>
      </div>
      <div
        className={cn(
          "fixed right-4 bottom-4 z-[60] flex items-center gap-4 text-[10px] leading-none font-semibold text-current transition-colors sm:right-6 sm:bottom-6",
          smoothTheme ? "duration-[900ms] ease-in-out" : "duration-100 ease-out"
        )}
      >
        {signedIn ? (
          <>
            <MembershipDialog theme={theme} />
            <a href="/login" className="underline-offset-4 hover:underline">
              Console
            </a>
            <a
              href="/auth/logout"
              onClick={onSignOut}
              className="underline-offset-4 hover:underline"
            >
              Sign out
            </a>
          </>
        ) : (
          <a
            href={joinHref}
            onClick={onAuthStart}
            className="underline-offset-4 hover:underline"
          >
            Sign in
          </a>
        )}
      </div>
    </>
  );
}
