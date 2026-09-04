import { getCurrentWaitlistSession } from "@/lib/waitlist/current-session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentWaitlistSession();
  if (!session) {
    return Response.json(
      { message: "Authentication required." },
      { status: 401 }
    );
  }
  return Response.json(session);
}
