import { getSessionUser } from "@/lib/auth";
import { addMessage } from "@/lib/feedback/desk";
import { commentOnFeedbackIssue } from "@/lib/github-feedback";
import { isOwnerEmail } from "@/lib/owner";
import { getFeedbackById } from "@/lib/store/basecamp";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const report = await getFeedbackById(id);
  if (!report) return Response.json({ error: "That note is not here." }, { status: 404 });
  const support = isOwnerEmail(user.email);
  if (report.userId !== user.id && !support) return Response.json({ error: "That note is not yours." }, { status: 404 });

  const payload = (await request.json().catch(() => null)) as { body?: string } | null;
  const body = String(payload?.body || "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (body.length < 2) return Response.json({ error: "Write a reply." }, { status: 400 });

  const message = await addMessage({
    feedbackId: id,
    userId: user.id,
    author: support && report.userId !== user.id ? "support" : "user",
    body,
  });
  if (report.githubIssueUrl && process.env.GITHUB_FEEDBACK_TOKEN) {
    try {
      await commentOnFeedbackIssue(report.githubIssueUrl, `${message.author === "support" ? "Support" : "Reply"}: ${body}`);
    } catch {
      // The reply is saved in the app even when GitHub is unavailable.
    }
  }
  return Response.json({ id: message.id });
}
