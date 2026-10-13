import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { vocabulary } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Shell quotesLabel={vocabulary(user.industry).quotes} guest={user.guest}>
      {children}
    </Shell>
  );
}
