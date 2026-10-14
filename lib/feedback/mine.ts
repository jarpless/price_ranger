import { listMessages, listTicketMetas } from "./desk";
import { listFeedback, type FeedbackStatus } from "../store/basecamp";

export function statusLabel(status: FeedbackStatus | string): string {
  if (status === "in_progress") return "In progress";
  if (status === "planned") return "Planned";
  if (status === "shipped") return "Shipped";
  return "New";
}

export async function myTickets(userId: string) {
  const [reports, metas] = await Promise.all([listFeedback(userId), listTicketMetas()]);
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));
  return reports.map((report) => {
    const meta = metaById.get(report.id);
    return {
      report,
      summary: meta?.summary || report.body.slice(0, 120),
      severity: meta?.severity || "medium",
      score: meta?.score || 0,
      lines: meta?.lines || [],
      duplicateOf: meta?.duplicateOf || null,
      source: meta?.source || "desktop",
      email: meta?.email || "",
    };
  });
}

export async function feedbackAssistantText(userId: string): Promise<string> {
  const tickets = await myTickets(userId);
  if (tickets.length === 0) {
    return "You have no feedback yet. Tap Feedback in the header, or open Menu and tap Send feedback. On a phone you can also shake it.";
  }
  const lines = ["Your feedback:"];
  for (const ticket of tickets.slice(0, 8)) {
    const messages = await listMessages(ticket.report.id);
    const last = messages[messages.length - 1];
    lines.push(
      `- [${ticket.summary}](/feedback/${ticket.report.id}) · ${statusLabel(ticket.report.status)}${last ? ` · last reply: ${last.body.slice(0, 80)}` : ""}`,
    );
  }
  lines.push("Open a note to reply in the thread.");
  return lines.join("\n");
}
