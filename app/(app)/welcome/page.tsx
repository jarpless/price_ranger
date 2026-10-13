import { redirect } from "next/navigation";

import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { WelcomeSlides } from "@/components/welcome-slides";
import { requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/auth";
import { onboardingCopy } from "@/lib/guide/flow";
import { ensureGuideUser, recordFunnel } from "@/lib/guide/store";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "landing", { variant: guide.variant });
  await recordFunnel(user.id, "signup", { variant: guide.variant });
  if (guide.tosAcceptedAt) redirect(safeNext(next || null));
  return (
    <>
      <GuideSetupNotice />
      <WelcomeSlides copy={onboardingCopy(guide.variant)} error={error === "terms"} next={safeNext(next || null)} />
    </>
  );
}
