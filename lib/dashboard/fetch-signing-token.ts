export type SigningTokenResponse = {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function fetchSigningToken(
  externalUserId: string,
): Promise<SigningTokenResponse> {
  const response = await fetch("/api/pymthouse/session/signing-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      externalUserId: externalUserId.trim(),
      scope: "sign:job",
    }),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof body.error_description === "string"
        ? body.error_description
        : typeof body.error === "string"
          ? body.error
          : `Signing token request failed (${response.status})`;
    throw new Error(message);
  }

  const accessToken =
    typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken) {
    throw new Error("Signing token response did not include access_token");
  }

  const expiresIn =
    typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
      ? body.expires_in
      : 900;

  const scope =
    typeof body.scope === "string" && body.scope.trim() ? body.scope.trim() : "sign:job";

  return {
    access_token: accessToken,
    expires_in: expiresIn,
    scope,
    token_type:
      typeof body.token_type === "string" && body.token_type.trim()
        ? body.token_type.trim()
        : "Bearer",
  };
}
