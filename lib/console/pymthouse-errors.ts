import { PmtHouseError } from "@pymthouse/builder-sdk";

/**
 * Pymthouse signals user-not-found with two envelopes: the REST shape
 * (`{ error: <prose>, code: "not_found" }`) and the OAuth shape used by the
 * mint-token route (`{ error: "not_found" }`, no `code`).
 */
export function isUserNotFoundError(error: unknown): boolean {
  if (!(error instanceof PmtHouseError) && !(error instanceof Error)) {
    return false;
  }
  const candidate = error as {
    status?: number;
    code?: string;
    message: string;
    details?: { error?: unknown } | null;
  };
  if (candidate.status !== 404) {
    return false;
  }
  if (candidate.code === "not_found" || candidate.message === "not_found") {
    return true;
  }
  return candidate.details?.error === "not_found";
}
