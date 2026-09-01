import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import LoginPage from "@/components/console/LoginPage";

const MCP_CALLBACK_PATH = "/api/mcp/oauth/callback";

export default async function LoginRoute({
  searchParams
}: {
  searchParams: Promise<{
    mcp_oauth?: string;
  }>;
}) {
  const params = await searchParams;
  const mcpOauth = params.mcp_oauth === "1";

  const session = await auth0.getSession();
  if (session) {
    if (mcpOauth) {
      redirect(MCP_CALLBACK_PATH);
    }
    redirect("/home");
  }

  return <LoginPage returnTo={mcpOauth ? MCP_CALLBACK_PATH : "/home"} />;
}
