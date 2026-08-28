import { PmtHouseError, type ParsedDeviceApprovalRedirect } from "@pymthouse/builder-sdk";

export type DeviceInitiateParseClient = {
  parseDeviceApprovalRedirect: (
    searchParams: URLSearchParams
  ) => ParsedDeviceApprovalRedirect;
};

export function parseDeviceInitiateParams(
  searchParams: URLSearchParams,
  client: DeviceInitiateParseClient,
  expectedClientId: string
): ParsedDeviceApprovalRedirect {
  const parsed = client.parseDeviceApprovalRedirect(searchParams);
  if (parsed.clientId !== expectedClientId) {
    throw new PmtHouseError("clientId does not match configured public client", {
      status: 400,
      code: "invalid_client",
    });
  }
  return parsed;
}

/** Auth0 returnTo must stay on /device (query allowed). */
export function isDeviceReturnTo(returnTo: string): boolean {
  if (!returnTo.startsWith("/device")) {
    return false;
  }
  if (returnTo === "/device") {
    return true;
  }
  return returnTo.startsWith("/device?");
}
