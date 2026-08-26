import "server-only";

import { PmtHouseError } from "@pymthouse/builder-sdk";

import {
  parseDeviceInitiateParams as parseDeviceInitiateParamsWithClient,
} from "@/lib/console/device-initiate";
import { createPmtHouseClientForPublicApp } from "@/lib/console/pymthouse-bff";
import { readPublicClientId } from "@/lib/console/pymthouse-http";

export { isDeviceReturnTo } from "@/lib/console/device-initiate";

export function parseDeviceInitiateParams(searchParams: URLSearchParams) {
  const publicClientId = readPublicClientId();
  return parseDeviceInitiateParamsWithClient(
    searchParams,
    createPmtHouseClientForPublicApp(publicClientId),
    publicClientId
  );
}

export async function approveDevice(input: {
  userCode: string;
  clientId: string;
  externalUserId: string;
  email?: string;
}): Promise<void> {
  const publicClientId = readPublicClientId();
  if (input.clientId !== publicClientId) {
    throw new PmtHouseError("clientId does not match configured public client", {
      status: 400,
      code: "invalid_client",
    });
  }
  const client = createPmtHouseClientForPublicApp(publicClientId);
  await client.approveDeviceLogin({
    externalUserId: input.externalUserId,
    userCode: input.userCode,
    email: input.email,
    publicClientId,
  });
}
