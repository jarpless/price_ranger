import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { FUNNEL_EVENTS } from "@/lib/guide/flow";
import { funnelHasServiceRole, listFunnelEvents } from "@/lib/guide/store";
import { isOwnerEmail } from "@/lib/owner";
import { dataBackend } from "@/lib/env";

export const metadata = { title: "Funnel" };

const LABELS: Record<(typeof FUNNEL_EVENTS)[number], string> = {
  landing: "Landing",
  signup: "Signup",
  terms_accepted: "Terms accepted",
  path_chosen: "Path chosen",
  first_price_generated: "First price",
  first_share: "First share",
  first_mark_sold: "First mark sold",
  trial_expiry: "Trial ended",
  upgrade_viewed: "Upgrade viewed",
  checkout_completed: "Checkout completed",
};

export default async function FunnelPage() {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  const events = await listFunnelEvents();
  const max = Math.max(1, ...FUNNEL_EVENTS.map((name) => events.filter((event) => event.name === name).length));
  const full = funnelHasServiceRole();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-5xl">Funnel</h1>
      <p className="mt-3 text-lg text-muted">
        {dataBackend() === "supabase" && !full
          ? "Showing this account only. Set SUPABASE_SERVICE_ROLE_KEY to read every account."
          : "Counts from the events stored for this install."}
      </p>
      <ul className="mt-6 space-y-3">
        {FUNNEL_EVENTS.map((name) => {
          const total = events.filter((event) => event.name === name).length;
          return (
            <li key={name} className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">{LABELS[name]}</p>
                <p className="font-serif text-3xl">{total}</p>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-pine" style={{ width: `${Math.round((total / max) * 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <h2 className="mt-8 font-serif text-3xl">Recent</h2>
      <ul className="mt-3 space-y-2">
        {events.slice(0, 12).map((event) => (
          <li key={event.id} className="flex items-baseline justify-between gap-3 text-base">
            <span>{LABELS[event.name]}</span>
            <span className="text-sm text-muted">{event.createdAt.slice(0, 16).replace("T", " ")}</span>
          </li>
        ))}
        {events.length === 0 ? <li className="text-base text-muted">No events yet.</li> : null}
      </ul>
    </div>
  );
}
