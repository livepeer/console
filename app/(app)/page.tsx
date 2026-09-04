import { redirect } from "next/navigation";
import { requireConsolePage } from "@/lib/access/page";

export const dynamic = "force-dynamic";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  if (params.ref?.trim())
    redirect(`/waitlist?ref=${encodeURIComponent(params.ref.trim())}`);
  await requireConsolePage("/home");
  redirect("/home");
}
