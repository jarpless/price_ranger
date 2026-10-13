export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailResult {
  sent: boolean;
  reason: "sent" | "unset" | "no-address" | "provider-error";
  detail?: string;
}

export function supportFrom(): string {
  return process.env.SUPPORT_FROM_EMAIL?.trim() || "Price Ranger <support@priceranger.app>";
}

export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendSupportEmail(message: MailMessage): Promise<MailResult> {
  const to = message.to.trim();
  if (!to || !to.includes("@")) return { sent: false, reason: "no-address" };
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "unset" };
  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();
  if (provider !== "resend") {
    return { sent: false, reason: "unset", detail: `EMAIL_PROVIDER=${provider} has no sender in this build.` };
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: supportFrom(),
        to: [to],
        subject: message.subject.slice(0, 180),
        text: message.text,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, reason: "provider-error", detail: detail.slice(0, 180) };
    }
    return { sent: true, reason: "sent" };
  } catch (error) {
    return {
      sent: false,
      reason: "provider-error",
      detail: error instanceof Error ? error.message : "Email was not sent.",
    };
  }
}

export function receiptEmail(input: { summary: string; kind: "bug" | "feature"; duplicate: boolean }): MailMessage["text"] {
  const next = input.duplicate
    ? "This matches a note we already have, so we attached yours to that one instead of opening a second ticket."
    : "We put it on the backlog. You can read the status and reply from My feedback in the app.";
  return [
    `We read this as a ${input.kind}: ${input.summary}`,
    "",
    next,
    "",
    "We will email you again when the status changes.",
    "",
    "Price Ranger",
    "support@priceranger.app",
  ].join("\n");
}

export function statusEmail(input: { summary: string; status: string; shippedIn: string | null }): string {
  const step =
    input.status === "planned"
      ? "It is on the list. We have not started it yet."
      : input.status === "in_progress"
        ? "Someone is working on it."
        : input.status === "shipped"
          ? `It shipped${input.shippedIn ? ` in ${input.shippedIn}` : ""}.`
          : "It is back in the new pile.";
  return [`Your note is now ${input.status.replace("_", " ")}.`, "", input.summary, "", step, "", "Price Ranger", "support@priceranger.app"].join("\n");
}
