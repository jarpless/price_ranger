import { PendingLink as Link } from "@/components/pending-link";

import { HideMenuOnDesktop } from "@/components/hide-menu-on-desktop";
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
    <div className="mx-auto max-w-[40rem] lg:hidden">
      <HideMenuOnDesktop />
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Menu</h1>
      <p className="mt-2 text-body text-muted">Prices, plans, and your account.</p>
      <ul className="list-card mt-4">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.href}>
              <Link href={link.href} data-spotlight={link.href === "/upgrade" ? "nav-plans" : undefined} className="list-row">
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0 text-pine" />
                  <span className="list-title">{link.label}</span>
                </span>
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
