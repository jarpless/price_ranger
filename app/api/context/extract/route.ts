import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { llmProvider } from "@/lib/assistant/llm";
import { draftWithAi, type ContextAttachment } from "@/lib/context/ai";
import { draftLines } from "@/lib/context/draft";
import { CONTEXT_LIMITS, contextFileProblem, contextKind, cleanTranscript, looksLikeTranscript, readContextFile, type ReadContext } from "@/lib/context/files";
import { draftFromRules } from "@/lib/context/rules";
import { pricingAccess } from "@/lib/guide/access";
import { mimeFor } from "@/lib/guide/photos";
import { assistantAllowance, recordAssistantUse } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail(401, "signin", "Sign in to add context.");
  const access = await pricingAccess(user);
  if (!access.ok) return fail(402, "limit", "You've used all your free prices.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(413, "large", "That was too much at once. Try fewer or smaller files.");
  }

  const skipped: string[] = [];
  const inputs: ReadContext[] = [];
  const attachments: ContextAttachment[] = [];
  const sourceNames: string[] = [];
  const pasted = String(form.get("text") || "").replace(/\r/g, "").trim().slice(0, CONTEXT_LIMITS.pastedChars);
  if (pasted) {
    const transcript = looksLikeTranscript(pasted);
    const name = transcript ? "Pasted transcript" : "Pasted text";
    inputs.push({ name, kind: transcript ? "transcript" : "text", text: transcript ? cleanTranscript(pasted) : pasted, tabular: pasted.split("\n")[0].includes("\t") });
    sourceNames.push(name);
  }

  const files = form.getAll("file").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  let total = 0;
  for (const file of files.slice(0, CONTEXT_LIMITS.files)) {
    const name = file.name.slice(0, 80) || "File";
    const problem = contextFileProblem(name, file.type, file.size);
    total += file.size;
    if (problem) {
      skipped.push(problem);
      continue;
    }
    if (total > CONTEXT_LIMITS.totalBytes) {
      skipped.push(`${name}: skipped to stay under 4 MB in total.`);
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = contextKind(name, file.type);
    sourceNames.push(name);
    if (kind === "image") {
      const mime = mimeFor(bytes, file.type);
      if (MODEL_IMAGES.has(mime)) attachments.push({ name, mime, bytes });
      else skipped.push(`${name}: this photo format can't be read here. Use JPEG or PNG.`);
      continue;
    }
    if (kind === "pdf") attachments.push({ name, mime: "application/pdf", bytes });
    try {
      const read = readContextFile(name, file.type, bytes);
      inputs.push(...read.filter((item) => item.text.trim()));
      if (kind !== "pdf" && !read.some((item) => item.text.trim())) skipped.push(`${name}: we couldn't find any text in it.`);
    } catch {
      skipped.push(`${name}: we couldn't open it.`);
    }
  }
  if (files.length > CONTEXT_LIMITS.files) skipped.push(`Only the first ${CONTEXT_LIMITS.files} files were read.`);
  if (!inputs.length && !attachments.length) {
    return fail(400, "empty", skipped[0] || "Add a file or paste some text first.");
  }

  const rules = draftFromRules(inputs, sourceNames);
  let draft = rules;
  let notice = "";
  const provider = llmProvider();
  const allowance = provider ? await assistantAllowance(user) : null;
  if (provider && allowance && allowance.remaining > 0) {
    const ai = await draftWithAi(inputs, attachments, sourceNames);
    if (ai) {
      await recordAssistantUse({ userId: user.id, mode: "ask", provider: ai.provider, model: ai.model, inputTokens: ai.inputTokens, outputTokens: ai.outputTokens }).catch(() => undefined);
      if (draftLines(ai.draft).length > 0 || draftLines(rules).length === 0) draft = ai.draft;
    } else {
      notice = "The AI reader didn't answer, so we read the lines we could. Check them below.";
    }
  } else if (attachments.length && !inputs.some((input) => input.text.trim())) {
    notice = provider
      ? "You've used this month's AI reads, so photos and scans can't be read. Type what's in them below."
      : "Photos and scans need the AI reader, which isn't set up here. Type what's in them below.";
  }

  return NextResponse.json({ draft, skipped, notice });
}
