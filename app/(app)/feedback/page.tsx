import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { statusLabel, myTickets } from "@/lib/feedback/mine";
import { isOwnerEmail } from "@/lib/owner";

export const metadata = { title: "My feedback" };

export default async function MyFeedbackPage() {
  const user = await requireUser();
  const tickets = await myTickets(user.id);
  const owner = isOwnerEmail(user.email);

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">My feedback</h1>
      <p className="mt-2 text-body text-muted">Notes you sent, and where each one stands.</p>
      {tickets.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-paper px-4 py-8 text-body text-muted">
          Nothing yet. Send feedback from the menu, or shake the phone.
        </p>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
          {tickets.map((ticket) => (
            <li key={ticket.report.id} className="border-b border-line last:border-b-0">
              <Link href={`/feedback/${ticket.report.id}`} className="block px-4 py-3">
                <span className="block text-base font-semibold">{ticket.summary}</span>
                <span className="mt-1 block text-caption text-muted">
                  {statusLabel(ticket.report.status)} · {ticket.report.kind === "bug" ? "Bug" : "Idea"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/feedback/new" className="mt-4 inline-flex h-12 items-center whitespace-nowrap text-base font-semibold text-pine">
        Send feedback
      </Link>
      {owner ? (
        <Link href="/admin/feedback" className="mt-2 block text-base font-semibold text-pine">
          Admin backlog
        </Link>
      ) : null}
    </div>
  );
}
