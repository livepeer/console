import { apiError, requireSameOrigin } from "@/lib/admin/http";
export const runtime = "nodejs";
/** Compatibility redirect only; Auth0 is responsible for clearing authentication. */
export function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.redirect(new URL("/auth/logout", request.url), 303);
  } catch (error) {
    return apiError(error);
  }
}
