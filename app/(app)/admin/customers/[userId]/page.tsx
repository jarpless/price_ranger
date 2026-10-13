import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { listAppEvents } from "@/lib/feedback/desk";
import { listFunnelEvents, termsAccepted } from "@/lib/guide/store";
import { isOwnerEmail } from "@/lib/owner";

export const metadata = { title: "Customer timeline" };

export default async function CustomerTimelinePage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  const { userId } = await params;
  const accepted = await termsAccepted(userId);
  const funnel = accepted ? (await listFunnelEvents()).filter((event) => event.userId === userId) : [];
  const screens = accepted ? await listAppEvents(userId) : [];
  const events = [
    ...funnel.map((event) => ({
      id: event.id,
      at: event.createdAt,
      label: event.name.replaceAll("_", " "),
      detail: "Account",
    })),
    ...screens.map((event) => ({
      id: event.id,
      at: event.createdAt,
      label: event.route || event.name,
      detail: event.deviceId ? `Device ${event.deviceId.slice(0, 8)}` : "This browser",
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Customer timeline</h1>
      <p className="mt-2 text-body text-muted">Screens and funnel events for this account, across the devices that checked in.</p>
      {accepted ? null : (
        <p className="mt-6 rounded-2xl border border-line bg-paper px-4 py-3 text-body">
          This person has not accepted the terms, so the timeline stays hidden.
        </p>
      )}
      {accepted && events.length === 0 ? (
        <p className="mt-6 text-body text-muted">No events yet.</p>
      ) : null}
      {accepted ? (
        <ol className="mt-6 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="rounded-2xl border border-line bg-paper px-4 py-3 shadow-card">
              <p className="text-base font-semibold">{event.label}</p>
              <p className="text-caption text-muted">
                {event.at.slice(0, 16).replace("T", " ")} · {event.detail}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
