import { getSessionUser } from "@/lib/auth";
import { saveTour, type TourStep } from "@/lib/store/basecamp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    prompt?: string;
    steps?: TourStep[];
  } | null;
  const steps = Array.isArray(body?.steps) ? body.steps.slice(0, 12) : [];
  const clean = steps.flatMap((step) => {
    if (!step || typeof step.caption !== "string") return [];
    return [
      {
        caption: step.caption.slice(0, 300),
        href: String(step.href || "/").slice(0, 200),
        spotlight: String(step.spotlight || "").slice(0, 80),
      },
    ];
  });
  if (clean.length === 0) return Response.json({ error: "Nothing to save." }, { status: 400 });
  const id = await saveTour({
    userId: user.id,
    title: String(body?.title || "Guided tour").slice(0, 120),
    prompt: String(body?.prompt || "").slice(0, 500),
    steps: clean,
  });
  return Response.json({ id });
}
