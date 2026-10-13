import { PendingLink as Link } from "@/components/pending-link";

import { signOut } from "@/app/actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

export const metadata = { title: "Menu" };

const GROUPS = [
  {
    title: "Feedback",
    links: [
      { href: "/feedback/new", label: "Send feedback" },
      { href: "/feedback", label: "My feedback" },
    ],
  },
  {
    title: "Prices",
    links: [
      { href: "/quotes", label: "All quotes" },
      { href: "/library", label: "Your prices" },
      { href: "/catalogs", label: "Catalog" },
      { href: "/library/groups", label: "Groups" },
      { href: "/quotes/new", label: "Detailed quote" },
      { href: "/dashboard", label: "Dashboard" },
      { href: "/calculators", label: "Calculators" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/settings", label: "Settings" },
      { href: "/upgrade", label: "Upgrade" },
      { href: "/install", label: "Get the app on your phone" },
      { href: "/shortcuts", label: "Shortcuts" },
    ],
  },
];

export default async function MenuPage() {
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const groups = GROUPS.map((group) => ({ ...group, links: [...group.links] }));
  if (owner) {
    groups.push({
      title: "Admin",
      links: [
        { href: "/admin/feedback", label: "Feedback backlog" },
        { href: "/admin/funnel", label: "Funnel" },
      ],
    });
  }

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Menu</h1>
      <p className="mt-2 text-body text-muted">Feedback is first. The rest of the tools are grouped below.</p>
      <div className="mt-6 space-y-6">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-caption font-semibold text-muted">{group.title}</h2>
            <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
              {group.links.map((link) => (
                <li key={link.href} className="border-b border-line last:border-b-0">
                  <Link href={link.href} className="flex h-12 items-center whitespace-nowrap px-4 text-base font-semibold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {user.guest ? (
        <Link href="/login?reason=save" className="mt-4 flex h-12 items-center justify-center whitespace-nowrap text-base font-semibold text-pine">
          Save account
        </Link>
      ) : (
        <form action={signOut} className="mt-4">
          <SubmitButton className="h-12 whitespace-nowrap text-base font-semibold text-pine">Sign out</SubmitButton>
        </form>
      )}
    </div>
  );
}
