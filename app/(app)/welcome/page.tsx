import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GuideSetupNotice } from "@/components/guide-setup-notice";
import { WelcomeSlides } from "@/components/welcome-slides";
import { requireUser, safeNext } from "@/lib/auth";
import { TOS_VERSION } from "@/lib/guide/config";
import { onboardingCopy } from "@/lib/guide/flow";
import { ensureGuideUser, recordFunnel, saveGuideUser } from "@/lib/guide/store";

export const metadata = { title: "Welcome" };

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const user = await requireUser();
  let guide;
  try {
    guide = await ensureGuideUser(user.id);
  } catch {
    redirect("/signin?notice=unavailable");
  }
  const stamped = (await cookies()).get("pr_tos_at")?.value || "";
  if (!guide.tosAcceptedAt && stamped) {
    guide.tosAcceptedAt = stamped;
    guide.tosVersion = TOS_VERSION;
    guide.introCompletedAt = guide.introCompletedAt || stamped;
    guide.trialStartedAt = guide.trialStartedAt || stamped;
    try {
      await saveGuideUser(guide);
    } catch {
      redirect("/signin?notice=unavailable");
    }
  }
  if (guide.tosAcceptedAt) redirect(safeNext(next || null));
  try {
    await recordFunnel(user.id, "landing", { variant: guide.variant });
    await recordFunnel(user.id, "signup", { variant: guide.variant });
  } catch {
    // The intro still shows when the funnel table is unavailable.
  }
  return (
    <>
      <GuideSetupNotice />
      <WelcomeSlides copy={onboardingCopy(guide.variant)} error={error === "terms"} next={safeNext(next || null)} />
    </>
  );
}
