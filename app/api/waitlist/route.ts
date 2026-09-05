export const runtime = "nodejs";
/** Legacy anonymous enrollment/sign-in links are retired. This performs no writes. */
export function POST() {
  return Response.json(
    {
      error: "auth0_signin_required",
      message: "Join or sign in with your Livepeer account.",
      signInUrl: "/api/waitlist/join",
    },
    { status: 410, headers: { "cache-control": "no-store" } }
  );
}
