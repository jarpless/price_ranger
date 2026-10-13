import { getSessionUser } from "@/lib/auth";
import { readExtraImage } from "@/lib/feedback/desk";
import { isOwnerEmail } from "@/lib/owner";
import { getFeedbackById, readFeedbackPng } from "@/lib/store/basecamp";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Not found", { status: 404 });
  const { id } = await context.params;
  const report = await getFeedbackById(id);
  if (!report) return new Response("Not found", { status: 404 });
  if (report.userId !== user.id && !isOwnerEmail(user.email)) return new Response("Not found", { status: 404 });
  const extra = new URL(request.url).searchParams.get("image");
  const bytes = extra ? await readExtraImage(id, extra) : await readFeedbackPng(report.userId, id);
  if (!bytes) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
