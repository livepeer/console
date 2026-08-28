import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import LoginPage from "@/components/console/LoginPage";

export default async function LoginRoute() {
  const session = await auth0.getSession();
  if (session) {
    redirect("/home");
  }

  return <LoginPage />;
}
