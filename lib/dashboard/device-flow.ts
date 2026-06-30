import { cookies } from "next/headers";
import { createPmtHouseClientForPublicApp } from "@/lib/dashboard/pymthouse-bff";

export const DEVICE_FLOW_COOKIE_NAME = "dashboard_device_flow";

export interface DeviceFlowState {
  iss: string;
  targetLinkUri: string;
  userCode: string;
  clientId: string;
}

export async function setDeviceFlowCookie(state: DeviceFlowState): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_FLOW_COOKIE_NAME, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readDeviceFlowCookie(): Promise<DeviceFlowState | null> {
  const jar = await cookies();
  const raw = jar.get(DEVICE_FLOW_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DeviceFlowState;
    if (
      !parsed.userCode ||
      !parsed.clientId ||
      !parsed.iss ||
      !parsed.targetLinkUri
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearDeviceFlowCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEVICE_FLOW_COOKIE_NAME);
}

export async function completeDashboardDeviceApproval(params: {
  userCode: string;
  publicClientId: string;
  externalUserId: string;
  email: string;
}): Promise<void> {
  const client = createPmtHouseClientForPublicApp(params.publicClientId);

  await client.upsertAppUser({
    externalUserId: params.externalUserId,
    email: params.email,
    status: "active",
  });

  const userToken = await client.mintUserAccessToken({
    externalUserId: params.externalUserId,
    scope: "sign:job",
  });

  await client.completeDeviceApproval({
    userJwt: userToken.access_token,
    userCode: params.userCode,
  });
}
