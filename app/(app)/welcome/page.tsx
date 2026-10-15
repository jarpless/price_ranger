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
  const guide = await ensureGuideUser(user.id);
  const stamped = (await cookies()).get("pr_tos_at")?.value || "";
  if (!guide.tosAcceptedAt && stamped) {
    const stampedGuide = {
      ...guide,
      tosAcceptedAt: stamped,
      tosVersion: TOS_VERSION,
      introCompletedAt: guide.introCompletedAt || stamped,
      trialStartedAt: guide.trialStartedAt || stamped,
    };
    try {
      await saveGuideUser(stampedGuide);
      guide.tosAcceptedAt = stampedGuide.tosAcceptedAt;
      guide.tosVersion = stampedGuide.tosVersion;
      guide.introCompletedAt = stampedGuide.introCompletedAt;
      guide.trialStartedAt = stampedGuide.trialStartedAt;
    } catch {
      // The account is still signed in. A missed stamp is not a deleted account.
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
    <div className="page-frame page-frame-pad">
      <GuideSetupNotice />
      {error === "save" ? (
        <p className="mb-4 rounded-2xl bg-[#f8f1df] px-4 py-3 text-body leading-6">
          We couldn&apos;t save that yet. Your account is still here. Try again.
        </p>
      ) : null}
      <WelcomeSlides copy={onboardingCopy(guide.variant)} error={error === "terms"} next={safeNext(next || null)} account={user.guest ? "guest" : "member"} />
    </div>
  );
}
