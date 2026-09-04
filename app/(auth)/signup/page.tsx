import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import LoginPage from "@/components/console/LoginPage";

export const metadata: Metadata = {
  title: "Sign up — Livepeer Early Access",
};

export default async function SignupRoute() {
  const session = await auth0.getSession();
  if (session) redirect("/home");
  return <LoginPage mode="signup" returnTo="/home" />;
}
