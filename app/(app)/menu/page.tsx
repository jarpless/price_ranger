import { PendingLink as Link } from "@/components/pending-link";

import { IconCamera, IconCard, IconChat, IconHome, IconPhone, IconSettings } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/owner";

export const metadata = { title: "Menu" };

const LINKS = [
  { href: "/new", label: "New price", icon: IconCamera },
  { href: "/", label: "Your prices", icon: IconHome },
  { href: "/upgrade", label: "Plans", icon: IconCard },
  { href: "/settings", label: "Settings", icon: IconSettings },
  { href: "/install", label: "Get the app", icon: IconPhone },
  { href: "/feedback/new", label: "Send feedback", icon: IconChat },
];

export default async function MenuPage() {
  const user = await requireUser();
  const owner = isOwnerEmail(user.email);

  return (
    <div className="mx-auto max-w-[40rem] lg:mx-0 lg:max-w-none">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Menu</h1>
      <p className="mt-2 text-body text-muted">Prices, plans, and your account.</p>
      <ul className="mt-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href} className="border-b border-line last:border-b-0">
              <Link href={link.href} className="flex h-12 items-center gap-3 whitespace-nowrap px-4 text-base font-semibold">
                <Icon className="h-5 w-5 text-pine" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {owner ? (
        <p className="mt-4">
          <Link href="/admin/feedback" className="text-base font-semibold text-pine">
            Feedback backlog
          </Link>
        </p>
      ) : null}
      {user.guest ? (
        <div className="mt-6 space-y-2">
          <Link href="/signin" className="flex h-12 items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream">
            Sign in
          </Link>
          <Link href="/signin?reason=save" className="flex h-12 items-center justify-center whitespace-nowrap text-base font-semibold text-pine">
            Save account
          </Link>
        </div>
      ) : null}
    </div>
  );
}
