import { getSessionUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";
import { readFeedbackPng } from "@/lib/store/basecamp";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !isOwnerEmail(user.email)) return new Response("Not found", { status: 404 });
  const { id } = await context.params;
  const bytes = await readFeedbackPng(user.id, id);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
