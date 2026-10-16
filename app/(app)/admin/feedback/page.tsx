import { PendingLink as Link } from "@/components/pending-link";
import { redirect } from "next/navigation";

import { saveFeedbackStatus } from "@/app/basecamp-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ensureSupportOwner } from "@/lib/feedback/desk";
import { statusLabel } from "@/lib/feedback/mine";
import { promptLabels, readFeedbackAnswers } from "@/lib/feedback/note";
import { isOwnerEmail } from "@/lib/owner";
import { listAllFeedback } from "@/lib/store/basecamp";
import { listTicketMetas } from "@/lib/feedback/desk";
import type { FeedbackStatus } from "@/lib/store/basecamp";

export const metadata = { title: "Feedback backlog" };

const STATUSES: FeedbackStatus[] = ["triage", "new", "planned", "in_progress", "shipped"];

export default async function FeedbackBacklogPage() {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  await ensureSupportOwner(user.email);
  const [reports, metas] = await Promise.all([listAllFeedback(), listTicketMetas()]);
  const metaById = new Map(metas.map((meta) => [meta.id, meta]));
  const rows = reports
    .map((report) => ({ report, meta: metaById.get(report.id) }))
    .sort((a, b) => {
      const closed = (status: string) => (status === "shipped" ? 1 : 0);
      const triage = (status: string) => (status === "triage" ? 0 : 1);
      return (
        closed(a.report.status) - closed(b.report.status) ||
        triage(a.report.status) - triage(b.report.status) ||
        (b.meta?.score || 0) - (a.meta?.score || 0) ||
        b.report.createdAt.localeCompare(a.report.createdAt)
      );
    });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Backlog</h1>
      <p className="mt-2 text-body text-muted">Open notes come first, starting with triage. Follow-up mail is not sent from here.</p>
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
                {statusLabel(report.status)} · {report.kind === "bug" ? "Bug" : "Feature request"}
                {meta?.email ? ` · ${meta.email}` : ""}
                {meta?.duplicateOf ? " · Duplicate" : ""}
              </p>
              {report.screenshotPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/feedback/${report.id}/image`} alt="Annotated screenshot" className="mt-3 max-h-48 w-full rounded-xl border border-line bg-cream object-contain" />
              ) : null}
              {(() => {
                const answers = readFeedbackAnswers(report.body);
                const [labelA, labelB] = promptLabels(report.kind);
                if (!answers.answerA && !answers.answerB) return null;
                return (
                  <div className="mt-3 space-y-2 text-body">
                    {answers.answerA ? (
                      <p>
                        <span className="font-semibold">{labelA}</span> {answers.answerA}
                      </p>
                    ) : null}
                    {answers.answerB ? (
                      <p>
                        <span className="font-semibold">{labelB}</span> {answers.answerB}
                      </p>
                    ) : null}
                    {answers.selection ? <p className="text-caption text-muted">Selection {answers.selection}</p> : null}
                  </div>
                );
              })()}
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
