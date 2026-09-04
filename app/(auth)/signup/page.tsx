import type { Metadata } from "next";
import LoginPage from "@/components/console/LoginPage";

export const metadata: Metadata = { title: "Sign up — Livepeer Early Access" };

export default function SignupRoute() {
  return <LoginPage mode="signup" />;
}
