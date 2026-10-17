import { redirect } from "next/navigation";

import { ContextComposer } from "@/components/context-composer";
import { BackLink } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pricingAccess } from "@/lib/guide/access";
import { ensureGuideUser } from "@/lib/guide/store";

export const metadata = { title: "Add context" };

export default async function AddContextPage() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome?next=/new/context");
  const access = await pricingAccess(user);
  if (!access.ok) redirect("/upgrade");

  return (
    <div className="content-split">
      <div>
        <BackLink href="/new">New price</BackLink>
        <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Add context</h1>
        <p className="mt-2 text-body text-muted">Add files, notes or a call. We&apos;ll build the price. You check it before it&apos;s saved.</p>
        <div className="mt-6">
          <ContextComposer />
        </div>
      </div>
      <aside className="content-aside min-w-0">
        <p className="font-serif text-title">What works</p>
        <ul className="page-stack mt-4">
          <li className="surface">
            <p className="text-base font-semibold">Selling one thing</p>
            <p className="mt-1 text-body text-muted">A listing, a receipt, or a photo of the box. You get one price and a fair range.</p>
          </li>
          <li className="surface">
            <p className="text-base font-semibold">Quoting a job</p>
            <p className="mt-1 text-body text-muted">An estimate, a price sheet, or notes from a walk-through. You get sections and line items.</p>
          </li>
          <li className="surface">
            <p className="text-base font-semibold">A call or meeting</p>
            <p className="mt-1 text-body text-muted">Paste the transcript or add the .vtt or .srt file. We pull out what was asked for.</p>
          </li>
        </ul>
      </aside>
    </div>
  );
}
