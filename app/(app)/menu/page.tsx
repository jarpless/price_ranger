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
  ];
  if (owner) links.push({ href: "/admin/funnel", label: "Funnel" });

  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <h1 className="font-serif text-5xl">Menu</h1>
      <p className="mt-3 text-lg text-muted">Everything else lives here.</p>
      <ul className="mt-6 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex h-14 items-center rounded-2xl border border-line bg-paper px-4 text-lg font-semibold">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      {user.guest ? (
        <Link href="/login?reason=save" className="mt-4 flex h-14 items-center justify-center rounded-2xl text-lg font-semibold text-pine">
          Save your account
        </Link>
      ) : (
        <form action={signOut} className="mt-4">
          <SubmitButton className="h-14 w-full text-lg font-semibold text-pine">Sign out</SubmitButton>
        </form>
      )}
    </div>
  );
}
