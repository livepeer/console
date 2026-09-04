import { redirect } from "next/navigation";
import { LivepeerHeader } from "@/components/livepeer-ui/livepeer-header";
import AccessManager from "@/components/admin/AccessManager";
import { getAdminWaitlistSummary } from "@/lib/waitlist/admin";
import { getAdminPrincipal } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminPrincipal();
  if (!admin) redirect("/waitlist");
  const summary = await getAdminWaitlistSummary();
  return (
    <main className="dark min-h-svh bg-background text-foreground">
      <LivepeerHeader
        homeHref="/waitlist"
        transparent
        utility={
          <a
            href="/api/admin/signups.csv"
            className="rounded border border-white/20 px-3 py-2 text-xs"
          >
            Export CSV
          </a>
        }
      />
      <section className="w-full px-4 py-10 font-sans sm:px-6 lg:px-10">
        <h1 className="font-display text-4xl font-light tracking-[-0.04em]">
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
              <dt className="text-xs text-white/50">{label}</dt>
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
