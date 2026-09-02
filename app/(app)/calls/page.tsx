import { redirect } from "next/navigation";

/**
 * `/calls` folded into `/usage` for the creator pilot — the call log now
 * renders underneath Spend by capability rather than as its own destination.
 *
 * The route stays as a redirect because `?request=<id>` links to a single call
 * are already in the wild (the app-detail log table, the Home activity panel
 * before it was removed, anything anyone bookmarked). The param carries over
 * so those still open the call drawer, just on Usage.
 */
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const request = params.request;
  const id = Array.isArray(request) ? request[0] : request;
  redirect(id ? `/usage?request=${encodeURIComponent(id)}` : "/usage");
}
