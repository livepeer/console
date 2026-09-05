import { redirect } from "next/navigation";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import AccessManager from "@/components/admin/AccessManager";
import { getAdminWaitlistSummary } from "@/lib/waitlist/admin";
import { getAdminPrincipal } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminPrincipal();
  if (!admin) redirect("/waitlist");
  const summary = await getAdminWaitlistSummary();
  return (
    <main
      id="main-content"
      className="flex min-h-full flex-1 flex-col bg-dark text-fg"
    >
      <ConsolePageHeader
        title="Waitlist administration"
        actions={
          <a
            href="/api/admin/signups.csv"
            className="rounded border border-hairline px-3 py-1 text-xs hover:bg-hover"
          >
            Export CSV
          </a>
        }
      />
      <section className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-7">
        <h1 className="text-2xl font-medium tracking-tight">
          Waitlist administration
        </h1>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
          {[
            ["Total signups", summary.totalSignups],
            ["Verified signups", summary.confirmedSignups],
            ["Total verified referrals", summary.totalVerifiedReferrals],
            ["Newsletter opt-ins", summary.newsletterSubscribers],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-fg-muted">{label}</dt>
              <dd className="mt-2 text-3xl font-light tabular-nums">
                {Number(value).toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
        <AccessManager />
      </section>
    </main>
  );
}
