import { redirect } from "next/navigation";

import { choosePath } from "@/app/guide-actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { pricingAccess } from "@/lib/guide/access";
import { ensureGuideUser } from "@/lib/guide/store";

export const metadata = { title: "Price something" };

const choices = [
  { path: "item", title: "Selling an item", body: "A table, a bike, a box of books." },
  { path: "job", title: "Quoting a job", body: "Work you will do for someone." },
  { path: "check", title: "Checking a price", body: "You want a number before you decide." },
];

export default async function NewPricePage() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  if (!guide.tosAcceptedAt) redirect("/welcome");
  const access = await pricingAccess(user);
  if (!access.ok) redirect("/upgrade");

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <h1 className="font-serif text-5xl leading-tight">What are you doing?</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">This picks the path. The steps stay the same.</p>
      <ul className="mt-6 space-y-3">
        {choices.map((choice) => (
          <li key={choice.path}>
            <form action={choosePath}>
              <input type="hidden" name="path" value={choice.path} />
              <SubmitButton className="h-auto w-full rounded-3xl border border-line bg-paper px-5 py-5 text-left hover:border-pine">
                <span className="block font-serif text-3xl">{choice.title}</span>
                <span className="mt-1 block text-base font-normal text-muted">{choice.body}</span>
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
