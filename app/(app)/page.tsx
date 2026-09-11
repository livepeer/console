import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  if (params.ref?.trim())
    redirect(`/waitlist?ref=${encodeURIComponent(params.ref.trim())}`);
  redirect("/home");
}
