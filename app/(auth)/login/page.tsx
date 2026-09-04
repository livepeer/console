import type { Metadata } from "next";
import LoginPage from "@/components/console/LoginPage";

export const metadata: Metadata = { title: "Sign in — Livepeer Early Access" };

export default function LoginRoute() {
  return <LoginPage mode="signin" />;
}
