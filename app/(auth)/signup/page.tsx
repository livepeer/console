import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { safeReturnTo } from "@/lib/console/auth-login";
import LoginPage from "@/components/console/LoginPage";
import { syncCanonicalUserBestEffort } from "@/lib/identity/canonical-user";

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
  if (session) {
    const sub = session.user.sub?.trim();
    if (sub) {
      await syncCanonicalUserBestEffort({
        sub,
        email: session.user.email?.trim() || undefined,
        emailVerified: session.user.email_verified === true,
      });
    }
    redirect(returnTo);
  }
  return <LoginPage mode="signup" returnTo={returnTo} />;
}
