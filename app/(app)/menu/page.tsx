import { PendingLink as Link } from "@/components/pending-link";

import { signOut } from "@/app/actions";
import { SubmitButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

export const metadata = { title: "Menu" };

export default async function MenuPage() {
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);
  const links = [
    { href: "/quotes", label: "All quotes" },
    { href: "/library", label: "Your prices" },
    { href: "/catalogs", label: "Catalog" },
    { href: "/library/groups", label: "Groups" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calculators", label: "Calculators" },
    { href: "/quotes/new", label: "Detailed quote" },
    { href: "/settings", label: "Settings" },
    { href: "/upgrade", label: "Upgrade" },
    { href: "/install", label: "Get the app on your phone" },
    { href: "/shortcuts", label: "Shortcuts" },
  ];
  if (owner) links.push({ href: "/admin/funnel", label: "Funnel" });

  return (
    <div className="mx-auto max-w-[40rem]">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Menu</h1>
      <p className="mt-2 text-body text-muted">Everything else lives here.</p>
      <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        {links.map((link) => (
          <li key={link.href} className="border-b border-line last:border-b-0">
            <Link href={link.href} className="flex h-12 items-center whitespace-nowrap px-4 text-base font-semibold">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
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
