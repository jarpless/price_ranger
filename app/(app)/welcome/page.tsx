import { redirect } from "next/navigation";

import { WelcomeSlides } from "@/components/welcome-slides";
import { requireUser } from "@/lib/auth";
import { onboardingCopy } from "@/lib/guide/flow";
import { ensureGuideUser, recordFunnel } from "@/lib/guide/store";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "landing", { variant: guide.variant });
  await recordFunnel(user.id, "signup", { variant: guide.variant });
  if (guide.tosAcceptedAt) redirect("/");
  return <WelcomeSlides copy={onboardingCopy(guide.variant)} error={error === "terms"} />;
}
