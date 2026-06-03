"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import AppCard from "@/components/dashboard/AppCard";
import {
  getOrganizationBySlug,
  appsForOrganization,
} from "@/lib/dashboard/mock-data";

/**
 * Public organization profile — like a GitHub organization page
 * (github.com/openai). Reached from any app's breadcrumb (the namespace links
 * here) or directly. Lists the organization's published apps. Public: no auth gate,
 * mirroring the Explore catalog.
 */
export default function OrganizationPage() {
  const { slug } = useParams<{ slug: string }>();
  const organization = getOrganizationBySlug(slug);

  if (!organization) {
    return (
      <main id="main-content" className="flex flex-1 flex-col bg-dark">
        <div className="mx-auto w-full max-w-3xl px-7 pt-20 text-center">
          <p className="text-[15px] font-medium text-fg">Organization not found</p>
          <p className="mt-1.5 text-[13px] text-fg-muted">
            No published apps belong to &ldquo;{slug}&rdquo;.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-green-bright hover:text-green-light"
          >
            Explore apps
          </Link>
        </div>
      </main>
    );
  }

  const apps = appsForOrganization(slug);

  return (
    <main id="main-content" className="flex flex-1 flex-col bg-dark">
      {/* An organization is a top-level publisher namespace (like a GitHub org
          page) — no parent breadcrumb. The header below carries its identity. */}
      <div className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-7 pt-7 pb-12">
          {/* Organization header — avatar + name + public-app count. */}
          <div className="flex items-center gap-4 pb-7">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md border border-subtle bg-dark-card text-[20px] font-semibold text-fg">
              {organization.initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">
                {organization.name}
              </h1>
              <p className="mt-1 text-[13px] text-fg-muted">
                {apps.length} public {apps.length === 1 ? "app" : "apps"}
              </p>
            </div>
          </div>

          {/* Published apps grid. */}
          {apps.length === 0 ? (
            <div className="rounded-md border border-hairline bg-dark-lighter px-6 py-14 text-center shadow-card">
              <p className="text-[14px] font-medium text-fg">
                No public apps yet
              </p>
              <p className="mx-auto mt-1.5 max-w-[420px] text-[12.5px] text-fg-muted">
                This organization hasn&apos;t published any apps to Explore.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <AppCard key={app.id} model={app} href={`/apps/${app.id}`} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
