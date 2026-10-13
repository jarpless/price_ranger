import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { saveFeedbackStatus } from "@/app/basecamp-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ensureSupportOwner } from "@/lib/feedback/desk";
import { statusLabel } from "@/lib/feedback/mine";
import { isOwnerEmail } from "@/lib/owner";
import { listAllFeedback } from "@/lib/store/basecamp";
import { listTicketMetas } from "@/lib/feedback/desk";
import type { FeedbackStatus } from "@/lib/store/basecamp";

export const metadata = { title: "Feedback backlog" };

const STATUSES: FeedbackStatus[] = ["new", "planned", "in_progress", "shipped"];

export default async function FeedbackBacklogPage() {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  await ensureSupportOwner(user.email);
  const [reports, metas] = await Promise.all([listAllFeedback(), listTicketMetas()]);
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));
  const rows = reports
    .map((report) => ({ report, meta: metaById.get(report.id) }))
    .sort((a, b) => (b.meta?.score || 0) - (a.meta?.score || 0) || b.report.createdAt.localeCompare(a.report.createdAt));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Backlog</h1>
      <p className="mt-2 text-body text-muted">Sorted by the score in docs/feedback-model.md. The lines under each note are the whole formula.</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-paper px-4 py-8 text-body text-muted">No notes yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map(({ report, meta }) => (
            <li key={report.id} className="rounded-2xl border border-line bg-paper p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/feedback/${report.id}`} className="text-base font-semibold">
                  {meta?.summary || report.body}
                </Link>
                <p className="font-serif text-title">{meta?.score ?? 0}</p>
              </div>
              <p className="mt-1 text-caption text-muted">
                {statusLabel(report.status)} · {report.kind === "bug" ? "Bug" : "Idea"}
                {meta?.duplicateOf ? " · Duplicate" : ""}
              </p>
              {meta && meta.lines.length > 0 ? (
                <ul className="mt-3 space-y-1">
                  {meta.lines.map((line) => (
                    <li key={line.factor} className="text-caption text-muted">
                      <span className="font-semibold text-ink">{line.factor} {line.points}.</span> {line.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-3">
                <Link href={`/admin/customers/${report.userId}`} className="text-base font-semibold text-pine">
                  Customer timeline
                </Link>
              </p>
              <form action={saveFeedbackStatus.bind(null, report.id)} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-caption font-semibold">
                  Status
                  <select name="status" defaultValue={report.status} className="mt-1 block h-12 rounded-2xl border border-line bg-paper px-3 text-body">
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-caption font-semibold">
                  Shipped in
                  <input name="shippedIn" defaultValue={report.shippedIn || ""} className="mt-1 block h-12 rounded-2xl border border-line px-3 text-body" />
                </label>
                <SubmitButton className="h-12 whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">Save</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
