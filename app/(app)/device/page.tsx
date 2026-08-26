import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";

import { auth0 } from "@/lib/auth0";
import ConsolePageHeader from "@/components/console/ConsolePageHeader";
import {
  parseDeviceInitiateParams,
} from "@/lib/console/device-approval";
import DeviceApproveForm from "./DeviceApproveForm";

export const dynamic = "force-dynamic";

export default async function DevicePage({
  searchParams,
}: {
  searchParams: Promise<{
    iss?: string;
    target_link_uri?: string;
    login_hint?: string;
  }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.iss) query.set("iss", params.iss);
  if (params.target_link_uri) query.set("target_link_uri", params.target_link_uri);
  if (params.login_hint) query.set("login_hint", params.login_hint);
  const returnTo = `/device${query.size ? `?${query.toString()}` : ""}`;

  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  let parsed;
  try {
    parsed = parseDeviceInitiateParams(query);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid device request";
    return (
      <>
        <ConsolePageHeader title="Device sign-in" icon={Smartphone} />
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <p className="text-sm text-red-400">{message}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <ConsolePageHeader title="Device sign-in" icon={Smartphone} />
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <DeviceApproveForm
          iss={parsed.issuer}
          targetLinkUri={parsed.targetLinkUri}
          userCode={parsed.userCode}
          clientId={parsed.clientId}
        />
      </div>
    </>
  );
}
