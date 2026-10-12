import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { executeTool } from "@/lib/assistant/execute";
import { isToolName, toolLeavesApp, toolNeedsConfirm } from "@/lib/assistant/tools";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    args?: Record<string, unknown>;
    confirmed?: boolean;
  } | null;
  const name = String(body?.name || "");
  if (!isToolName(name)) return Response.json({ error: "That action is not available." }, { status: 400 });

  const args: Record<string, string> = {};
  for (const [key, value] of Object.entries(body?.args || {})) {
    if (value == null) continue;
    args[key] = String(value).slice(0, 8000);
  }

  if ((toolNeedsConfirm(name, args) || toolLeavesApp(name, args)) && body?.confirmed !== true) {
    return Response.json({ error: "Confirm this before it runs." }, { status: 409 });
  }

  const effect = await executeTool(user.id, name, args);
  revalidatePath("/", "layout");
  return Response.json(effect);
}
