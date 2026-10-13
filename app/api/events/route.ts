import { getSessionUser } from "@/lib/auth";
import { addAppEvent } from "@/lib/feedback/desk";
import { termsAccepted } from "@/lib/guide/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const accepted = await termsAccepted(user.id);
  if (!accepted) return Response.json({ ok: true, stored: false });
  const payload = (await request.json().catch(() => null)) as { name?: string; route?: string; deviceId?: string } | null;
  const name = String(payload?.name || "screen").slice(0, 40);
  const route = String(payload?.route || "/").slice(0, 200);
  const deviceId = String(payload?.deviceId || "").slice(0, 80);
  await addAppEvent({ userId: user.id, deviceId, name, route });
  return Response.json({ ok: true, stored: true });
}
