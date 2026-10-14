import { getSessionUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { vocabulary } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) return children;
  return (
    <Shell
      quotesLabel={vocabulary(user.industry).quotes}
      guest={user.guest}
      accountLabel={user.guest ? null : user.email || "Signed in"}
    >
      {children}
    </Shell>
  );
}
