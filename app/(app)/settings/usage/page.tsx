import { PendingLink as Link } from "@/components/pending-link";

import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";
import { PLANS } from "@/lib/plans";
import { listUsage } from "@/lib/store/basecamp";
import { dataBackend } from "@/lib/env";
import { assistantAllowance } from "@/lib/usage";

export const dynamic = "force-dynamic";

export const metadata = { title: "Usage" };

export default async function UsagePage() {
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const allowance = await assistantAllowance(user);
  const rows = await listUsage(user.id, owner && dataBackend() !== "supabase");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/settings" className="text-sm font-semibold text-pine">
        Settings
      </Link>
      <h1 className="font-serif text-4xl">Usage</h1>
      <p className="text-sm leading-relaxed text-muted">
        {PLANS[user.plan].name} includes {allowance.cap} assistant messages a month. {allowance.used} used.
      </p>
      {owner && dataBackend() === "supabase" ? (
        <p className="text-sm leading-relaxed text-muted">
          This page shows your account. Every account is in the assistant_usage table for a SQL review.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line bg-paper px-4 py-8 text-center text-sm text-muted">
          No model calls yet.
        </p>
      ) : (
        <div className="scroll-x rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 font-semibold">Mode</th>
                <th className="px-4 py-3 font-semibold">Model</th>
                <th className="px-4 py-3 font-semibold">Tokens</th>
                <th className="px-4 py-3 font-semibold">Cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">{row.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-4 py-3">{row.mode}</td>
                  <td className="px-4 py-3">{row.model}</td>
                  <td className="px-4 py-3">{row.inputTokens + row.outputTokens}</td>
                  <td className="px-4 py-3">${row.costUsd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
