import { Mail } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import SectionHeader from "@/components/console/SectionHeader";
import { isEmailAllowlisted } from "@/lib/console/email-allowlist";

export const dynamic = "force-dynamic";

export default async function WaitlistPage() {
  const session = await auth0.getSession();
  const email = session?.user?.email;
  const listed = isEmailAllowlisted(email);

  return (
    <>
      <ConsolePageHeader title="Waitlist" icon={Mail} />
      <main className="mx-auto w-full max-w-5xl px-5 py-8">
        <SectionHeader
          variant="default"
          title={listed ? "You're on the list" : "Invite-only"}
          description={
            listed
              ? "Your email is allowlisted. Continue to Home."
              : "This Console is invite-only. We logged your interest. The MCP connector still requires a campaign invite."
          }
        />
        {email ? (
          <p className="font-mono text-xs text-fg-muted">{email}</p>
        ) : (
          <p className="text-sm text-fg-muted">
            <a className="text-green-bright underline" href="/login">
              Sign in
            </a>{" "}
            to join the waitlist with your account email.
          </p>
        )}
        {listed ? (
          <p className="mt-4">
            <a className="text-sm text-green-bright underline" href="/home">
              Enter Console
            </a>
          </p>
        ) : null}
      </main>
    </>
  );
}
