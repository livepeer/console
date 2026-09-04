/** SDK login route. Must be a full navigation (`<a>` / `location.assign`),
 *  not a Next.js client transition — middleware mounts `/auth/*`. */
export const AUTH_LOGIN_PATH = "/auth/login";

const DEFAULT_RETURN_TO = "/home";

export function authLoginHref(options?: {
  signup?: boolean;
  returnTo?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.signup) params.set("screen_hint", "signup");
  params.set("returnTo", options?.returnTo ?? DEFAULT_RETURN_TO);
  return `${AUTH_LOGIN_PATH}?${params.toString()}`;
}

export const AUTH_SIGNIN_HREF = authLoginHref();
export const AUTH_SIGNUP_HREF = authLoginHref({ signup: true });
