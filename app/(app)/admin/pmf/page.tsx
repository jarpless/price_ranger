import Link from "next/link";
import { redirect } from "next/navigation";

import { summarize, percent } from "@/lib/analytics/metrics";
import { readPmfData } from "@/lib/analytics/read";
import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activation and repeat" };

function Bar({ label, value, of, max }: { label: string; value: number; of?: number; max: number }) {
  return (
    <li className="rounded-3xl border border-line bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-semibold">{label}</p>
        <p className="font-serif text-3xl tabular-nums">
          {value}
          {of != null ? <span className="ml-2 text-base text-muted">{percent(value, of)}</span> : null}
        </p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-pine" style={{ width: `${Math.round((value / Math.max(1, max)) * 100)}%` }} />
      </div>
    </li>
  );
}

export default async function PmfPage() {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  let data: Awaited<ReturnType<typeof readPmfData>> | null = null;
  let failure = "";
  try {
    data = await readPmfData();
  } catch (error) {
    failure = error instanceof Error ? error.message : "Events could not be read.";
  }
  const summary = summarize(data?.events ?? [], data?.excluded);
  const { funnel, share, paid } = summary;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Activation and repeat</h1>
      <p className="mt-3 text-lg text-muted">
        Last 120 days. Owner and test accounts are left out. Definitions are in docs/pmf-events.md.
        {data?.scope === "own" ? " Showing this account only. Set SUPABASE_SERVICE_ROLE_KEY on the server to read every account." : ""}
        {data?.truncated ? " Only the first 20,000 events were read." : ""}
      </p>
      {failure ? <p className="mt-4 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body">{failure}</p> : null}

      <h2 className="mt-8 font-serif text-3xl">Activation funnel</h2>
      <ul className="mt-3 space-y-3">
        <Bar label="Signed up" value={funnel.signups} max={funnel.signups} />
        <Bar label="First price within 24h" value={funnel.activated24h} of={funnel.signups} max={funnel.signups} />
        <Bar label="Priced at all" value={funnel.priced} of={funnel.signups} max={funnel.signups} />
        <Bar label="Shared a quote" value={funnel.shared} of={funnel.signups} max={funnel.signups} />
        <Bar label="Second price within 7 days" value={funnel.secondPrice7d} of={funnel.priced} max={funnel.signups} />
        <Bar label="Marked sold" value={funnel.sold} of={funnel.signups} max={funnel.signups} />
        <Bar label="Paid within 30 days" value={funnel.paid30d} of={funnel.priced} max={funnel.signups} />
      </ul>

      <h2 className="mt-8 font-serif text-3xl">Repeat use by signup week</h2>
      <p className="mt-2 text-base text-muted">
        Repeat price: another price 1–2 days (D1), 1–7 days (D7), or 8–30 days (D30) after the first, as a share of accounts that priced.
        Return: a new session 1–2 days or 1–7 days after signup, as a share of signups.
      </p>
      <div className="mt-3 overflow-x-auto rounded-3xl border border-line bg-paper">
        <table className="w-full text-left text-base tabular-nums">
          <thead className="text-sm text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Week</th>
              <th className="px-3 py-3 font-semibold">Signups</th>
              <th className="px-3 py-3 font-semibold">Priced</th>
              <th className="px-3 py-3 font-semibold">Return D1</th>
              <th className="px-3 py-3 font-semibold">Return D7</th>
              <th className="px-3 py-3 font-semibold">Repeat D1</th>
              <th className="px-3 py-3 font-semibold">Repeat D7</th>
              <th className="px-3 py-3 font-semibold">Repeat D30</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {summary.cohorts.map((row) => (
              <tr key={row.week}>
                <td className="px-4 py-3">{row.week}</td>
                <td className="px-3 py-3">{row.signups}</td>
                <td className="px-3 py-3">{row.activated}</td>
                <td className="px-3 py-3">{percent(row.returnedD1, row.signups)}</td>
                <td className="px-3 py-3">{percent(row.returnedD7, row.signups)}</td>
                <td className="px-3 py-3">{percent(row.repeatD1, row.activated)}</td>
                <td className="px-3 py-3">{percent(row.repeatD7, row.activated)}</td>
                <td className="px-3 py-3">{percent(row.repeatD30, row.activated)}</td>
              </tr>
            ))}
            {summary.cohorts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-3 text-muted">No signups yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8 font-serif text-3xl">Share loop</h2>
      <ul className="mt-3 space-y-3">
        <Bar label="Share-page visitors" value={share.viewers} max={share.viewers} />
        <Bar label="Tapped the header" value={share.headerClickers} of={share.viewers} max={share.viewers} />
        <Bar label="Tapped sign up" value={share.signupClickers} of={share.viewers} max={share.viewers} />
        <Bar label="Signed up from a share" value={share.signupsFromShare} of={share.signupClickers} max={share.viewers} />
      </ul>
      <p className="mt-2 text-sm text-muted">{share.views} page views in total.</p>

      <h2 className="mt-8 font-serif text-3xl">Paid funnel</h2>
      <ul className="mt-3 space-y-3">
        <Bar label="Viewed plans" value={paid.planViewers} max={paid.planViewers} />
        <Bar label="Started checkout" value={paid.checkoutStarters} of={paid.planViewers} max={paid.planViewers} />
        <Bar label="Purchased" value={paid.purchasers} of={paid.planViewers} max={paid.planViewers} />
      </ul>

      <p className="mt-8 text-sm text-muted">
        {summary.events} events counted. <Link href="/admin/funnel" className="underline">Onboarding funnel</Link>
      </p>
    </div>
  );
}
