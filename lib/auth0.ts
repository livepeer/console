import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Preview hosts change per deploy. A static APP_BASE_URL (or next.config bake
// of VERCEL_BRANCH_URL) makes Auth0 set the `__txn_` cookie on one host and
// return to another — "The state parameter is invalid".
if (process.env.VERCEL_ENV === "preview") {
  delete process.env.APP_BASE_URL;
}

export const auth0 = new Auth0Client();
