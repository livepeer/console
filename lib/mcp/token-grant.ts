import { parseAuthCode, verifyPkceS256, type AuthCodeGrant } from "./as";
import { isKnownClientId } from "./cimd";

export type AuthorizationCodeGrant = AuthCodeGrant & { externalUserId: string };

export type TokenGrantError =
  | "invalid_request"
  | "invalid_grant"
  | "invalid_client";

export type TokenGrantResult =
  | { ok: true; grant: AuthorizationCodeGrant }
  | {
      ok: false;
      error: TokenGrantError;
      /** Server-side only. The token endpoint never returns this to the client. */
      reason: string;
    };

function fail(error: TokenGrantError, reason: string): TokenGrantResult {
  return { ok: false, error, reason };
}

/**
 * Validates an `authorization_code` redemption. `redirect_uri` is compared
 * byte-for-byte against the authorize request per RFC 6749 §4.1.3 — the
 * loopback/port normalization in `dcr.ts` applies to *registration* matching
 * only, and every client we support (Claude, Codex, Hermes) replays the exact
 * URI it authorized with.
 */
export function validateAuthorizationCodeGrant(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
}): TokenGrantResult {
  if (!input.code || !input.redirectUri || !input.codeVerifier) {
    return fail(
      "invalid_request",
      "code, redirect_uri, and code_verifier are required"
    );
  }

  const grant = parseAuthCode(input.code);
  if (!grant) {
    return fail("invalid_grant", "authorization code is unknown or expired");
  }
  if (grant.redirectUri !== input.redirectUri) {
    return fail(
      "invalid_grant",
      "redirect_uri differs from the authorize request"
    );
  }
  if (input.clientId) {
    if (grant.clientId !== input.clientId || !isKnownClientId(input.clientId)) {
      return fail(
        "invalid_client",
        "client_id differs from the authorize request"
      );
    }
  }
  if (!verifyPkceS256(input.codeVerifier, grant.codeChallenge)) {
    return fail("invalid_grant", "code_verifier does not match code_challenge");
  }
  if (!grant.externalUserId) {
    return fail("invalid_grant", "authorization code carries no end-user");
  }

  return {
    ok: true,
    grant: { ...grant, externalUserId: grant.externalUserId },
  };
}
