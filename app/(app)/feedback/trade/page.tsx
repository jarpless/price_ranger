import { FeatureRequestForm } from "@/components/feature-request-form";
import { requireUser } from "@/lib/auth";
import { defaultTrade } from "@/lib/beta";

export const metadata = { title: "Request a feature" };

export default async function FeatureRequestPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const user = await requireUser();
  return (
    <FeatureRequestForm
      initialTrade={defaultTrade(user.industry)}
      canFollowUp={!user.guest && Boolean(user.email)}
      from={/^[a-z]{1,16}$/.test(from || "") ? String(from) : "menu"}
    />
  );
}
