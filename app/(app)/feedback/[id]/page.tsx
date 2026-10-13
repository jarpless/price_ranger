import { PendingLink as Link } from "@/components/pending-link";
import { notFound } from "next/navigation";

import { FeedbackReply } from "@/components/feedback-reply";
import { requireUser } from "@/lib/auth";
import { listHistory, listImages, listMessages, metaFor } from "@/lib/feedback/desk";
import { statusLabel } from "@/lib/feedback/mine";
import { isOwnerEmail } from "@/lib/owner";
import { getFeedbackById } from "@/lib/store/basecamp";

export const metadata = { title: "Feedback" };

export default async function FeedbackThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const report = await getFeedbackById(id);
  if (!report) notFound();
  const owner = isOwnerEmail(user.email);
  if (report.userId !== user.id && !owner) notFound();
  const [meta, messages, history, images] = await Promise.all([
    metaFor(id),
    listMessages(id),
    listHistory(id),
    listImages(id),
  ]);

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">{meta?.summary || report.body}</h1>
      <p className="mt-2 text-caption text-muted">
        {statusLabel(report.status)} · {report.kind === "bug" ? "Bug" : "Idea"} · {report.route}
      </p>
      {meta?.duplicateOf ? (
        <p className="mt-3 text-body">
          This matches{" "}
          <Link href={`/feedback/${meta.duplicateOf}`} className="font-semibold text-pine">
            an existing note
          </Link>
          .
        </p>
      ) : null}
      {report.body !== (meta?.summary || report.body) ? <p className="mt-4 text-body leading-6">{report.body}</p> : null}
      {report.screenshotPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/feedback/${report.id}/image`} alt="Screenshot attached to this note" className="mt-4 max-h-64 rounded-2xl border border-line bg-paper object-contain" />
      ) : null}
      {images.length > 0 ? (
        <ul className="mt-3 flex gap-3 overflow-x-auto">
          {images.map((image) => (
            <li key={image.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/feedback/${report.id}/image?image=${image.id}`} alt="" className="h-24 rounded-2xl border border-line object-cover" />
            </li>
          ))}
        </ul>
      ) : null}
      {owner && meta && meta.lines.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-line bg-paper p-4 shadow-card">
          <p className="text-base font-semibold">Score {meta.score}</p>
          <ul className="mt-2 space-y-2">
            {meta.lines.map((line) => (
              <li key={line.factor} className="text-body">
                <span className="font-semibold">{line.factor} · {line.points}</span>
                <span className="mt-1 block text-caption text-muted">{line.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {history.length > 0 ? (
        <ol className="mt-6 space-y-2">
          {history.map((entry) => (
            <li key={entry.id} className="text-caption text-muted">
              {entry.createdAt.slice(0, 16).replace("T", " ")} · {entry.fromStatus ? `${statusLabel(entry.fromStatus)} to ` : ""}
              {statusLabel(entry.toStatus)}
              {entry.note ? ` · ${entry.note}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
      <ul className="mt-6 space-y-3">
        {messages.map((message) => (
          <li key={message.id} className={`rounded-2xl px-4 py-3 text-body ${message.author === "support" ? "bg-[#e7f0ea]" : "bg-paper border border-line"}`}>
            <p className="text-caption font-semibold text-muted">{message.author === "support" ? "Support" : "You"}</p>
            <p className="mt-1">{message.body}</p>
          </li>
        ))}
      </ul>
      <FeedbackReply id={report.id} />
    </div>
  );
}
