import { llmProvider } from "../assistant/llm";
import { looksLikeFilename } from "./pricing";

export interface PhotoIdentity {
  title: string;
  note: string;
}

const PROMPT =
  'Name the main thing in this photo the way a seller would, in a few words. Reply with JSON only: {"title":"short name","note":"one plain sentence"}. Never use a filename, camera id, or file extension. If you cannot tell what it is, reply {"title":""}. Do not guess a variant. A Nintendo Switch is "Nintendo Switch with dock and Joy-Cons" unless the word OLED or Lite is printed on the device. A Switch is not a television.';

/** Keeps a photo title from being priced as the wrong model. */
export function normalizePhotoTitle(title: string): string {
  const text = title.replace(/\s+/g, " ").trim();
  if (/\b(tv|television|monitor)\b/i.test(text) && !/joy-?con/i.test(text)) {
    return /switch/i.test(text) ? "Nintendo Switch with dock and Joy-Cons" : "";
  }
  if (/nintendo\s+switch|\bswitch\b/i.test(text) && !/\b(oled|lite)\b/i.test(text)) {
    return "Nintendo Switch with dock and Joy-Cons";
  }
  return text;
}

function stubAllowed(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  return process.env.VISION_STUB === "1";
}

function parseIdentity(raw: string): PhotoIdentity | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { title?: unknown; note?: unknown };
    const title = normalizePhotoTitle(String(parsed.title || "")).slice(0, 80);
    if (!title || looksLikeFilename(title)) return null;
    const note = String(parsed.note || "").replace(/\s+/g, " ").trim().slice(0, 180);
    return { title, note: note || `Priced from the photo of ${title}.` };
  } catch {
    return null;
  }
}

async function identifyWithOpenAi(bytes: Uint8Array, mime: string): Promise<PhotoIdentity | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` } },
          ],
        },
      ],
      max_tokens: 120,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return parseIdentity(payload.choices?.[0]?.message?.content || "");
}

async function identifyWithAnthropic(bytes: Uint8Array, mime: string): Promise<PhotoIdentity | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_VISION_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: Buffer.from(bytes).toString("base64") } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { content?: { text?: string }[] };
  return parseIdentity(payload.content?.map((part) => part.text || "").join("") || "");
}

/**
 * Names the object in a photo. Returns null when no model is configured or the photo cannot be read,
 * so the caller can ask for a line instead of inventing a filename title.
 */
export async function identifyPhoto(bytes: Uint8Array, mime: string): Promise<PhotoIdentity | null> {
  if (bytes.length < 32) return null;
  if (/heic|heif/i.test(mime)) return null;
  if (stubAllowed()) {
    return {
      title: "KitchenAid stand mixer",
      note: "A used stand mixer, priced from the photo.",
    };
  }
  const provider = llmProvider();
  try {
    if (provider === "openai") return await identifyWithOpenAi(bytes, mime || "image/jpeg");
    if (provider === "anthropic") return await identifyWithAnthropic(bytes, mime || "image/jpeg");
  } catch {
    return null;
  }
  return null;
}
