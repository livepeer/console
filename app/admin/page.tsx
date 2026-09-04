import { redirect } from "next/navigation";
import { Download } from "lucide-react";

import { LivepeerHeader } from "@/components/livepeer-ui/livepeer-header";
import { buttonVariants } from "@/components/ui/button";
import {
  getAdminWaitlistRows,
  getAdminWaitlistSummary,
} from "@/lib/waitlist/admin";
import { getAdminSession } from "@/lib/waitlist/admin-auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/waitlist");

  const [rows, summary] = await Promise.all([
    getAdminWaitlistRows(),
    getAdminWaitlistSummary(),
  ]);

  return (
    <main className="dark min-h-svh bg-background text-foreground">
      <LivepeerHeader
        homeHref="/waitlist"
        transparent
        utility={
          <div className="flex items-center">
            <a
              href="/api/admin/signups.csv"
              className={cn(
                buttonVariants({ variant: "muted", size: "sm" }),
                "h-8 rounded-sm px-3 text-[10px] dark:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]"
              )}
            >
              <Download className="size-3.5" aria-hidden="true" />
              Export CSV
            </a>
          </div>
        }
      />

      <section className="w-full px-4 py-10 font-sans sm:px-6 lg:px-10">
        <h1 className="font-display text-4xl font-light tracking-[-0.04em]">
          Waitlist
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
              <dd className="mt-2 text-3xl font-light tracking-[-0.04em] tabular-nums">
                {Number(value).toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 overflow-x-auto border-y border-white/15">
          <table className="w-full min-w-[72rem] text-left text-xs">
            <thead className="border-b border-white/15 text-xs text-white/50">
              <tr>
                <th className="py-3 pr-6 font-medium">Email</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Referred by</th>
                <th className="px-3 py-3 text-right font-medium">
                  Verified referrals
                </th>
                <th className="px-3 py-3 text-right font-medium">
                  Pending referrals
                </th>
                <th className="px-3 py-3 text-right font-medium">Points</th>
                <th className="px-3 py-3 font-medium">Newsletter</th>
                <th className="py-3 pl-6 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row) => (
                <tr key={row.email}>
                  <td className="py-3 pr-6 font-medium">{row.email}</td>
                  <td className="px-3 py-3 text-white/65">{row.status}</td>
                  <td className="max-w-64 truncate px-3 py-3 text-white/65">
                    {row.referredByEmail ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.verifiedReferrals}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.pendingReferrals}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {row.points}
                  </td>
                  <td className="px-3 py-3 text-white/65">
                    {row.marketingConsent ? "Subscribed" : "Not subscribed"}
                  </td>
                  <td className="py-3 pl-6 text-white/65">
                    {row.firstSeenAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
