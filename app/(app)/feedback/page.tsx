import { PendingLink as Link } from "@/components/pending-link";
import { notFound } from "next/navigation";

import { saveFeedbackStatus } from "@/app/basecamp-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";
import { listFeedback, type FeedbackStatus } from "@/lib/store/basecamp";
import { VERSION_LABEL } from "@/lib/version";

export const metadata = { title: "Feedback" };

const STATUSES: FeedbackStatus[] = ["new", "planned", "in_progress", "shipped"];

export default async function FeedbackPage() {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) notFound();
  const reports = await listFeedback(user.id);

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-4xl">Feedback</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        New notes wait here. Move one to planned, in progress, or shipped. When it ships, record the version, such as {VERSION_LABEL}.
      </p>
      {reports.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper px-4 py-8 text-sm text-muted">
          Nothing yet. Turn on feedback in Settings, then drag a region.
        </p>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => (
            <li key={report.id} className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <span>{report.kind}</span>
                <span>{report.versionLabel}</span>
                <span>{report.env}</span>
                <span>{report.viewport}</span>
              </div>
              <p className="mt-2 text-base leading-relaxed">{report.body}</p>
              <p className="mt-1 text-sm text-muted">{report.route}</p>
              {report.screenshotPath ? (
                <Link href={`/api/feedback/${report.id}/image`} className="mt-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/feedback/${report.id}/image`}
                    alt="Feedback region"
                    className="max-h-48 rounded-2xl border border-line"
                  />
                </Link>
              ) : null}
              {report.githubIssueUrl ? (
                <p className="mt-2 text-sm">
                  <a href={report.githubIssueUrl} className="font-semibold text-pine">
                    GitHub issue
                  </a>
                </p>
              ) : null}
              {report.consoleErrors.length > 0 ? (
                <pre className="mt-3 overflow-x-auto rounded-2xl bg-cream p-3 text-xs text-muted">
                  {report.consoleErrors.join("\n")}
                </pre>
              ) : null}
              <form action={saveFeedbackStatus.bind(null, report.id)} className="mt-4 flex flex-wrap items-end gap-2">
                <label className="text-sm font-medium">
                  Status
                  <select name="status" defaultValue={report.status} className="mt-1 block h-10 rounded-xl border border-line bg-paper px-2">
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Shipped in
                  <input
                    name="shippedIn"
                    defaultValue={report.shippedIn || ""}
                    placeholder={VERSION_LABEL}
                    className="mt-1 block h-10 rounded-xl border border-line px-2"
                  />
                </label>
                <SubmitButton pendingLabel="Saving…" className="h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-cream">
                  Save
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
