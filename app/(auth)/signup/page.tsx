import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { safeReturnTo } from "@/lib/console/auth-login";
import LoginPage from "@/components/console/LoginPage";

export const metadata: Metadata = {
  title: "Sign up — Livepeer Early Access",
};

export default async function SignupRoute({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const session = await auth0.getSession();
  if (session) redirect(returnTo);
  return <LoginPage mode="signup" returnTo={returnTo} />;
}
