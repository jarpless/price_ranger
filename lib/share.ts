import { dataBackend } from "./env";
import { sendSupportEmail } from "./feedback/mail";
import { adjustmentFromSources, lineSettlement, linesAtAsking, settledTotal, type Adjustment } from "./guide/pricing";
import { formatUsd } from "./money";
import { publishLocalSheet, readLocalSheet } from "./store/local";
import { createClient } from "./supabase/server";
import type { ItemGroup, QuoteRecord } from "./types";

export interface SheetLine {
  name: string;
  detail: string;
  price: string;
}

export interface SheetOption {
  name: string;
  lines: SheetLine[];
  total: string;
}

export interface SheetMedia {
  id: string;
  kind: "image" | "video";
}

export interface SharedSheet {
  title: string;
  subtitle: string;
  photo?: string | null;
  media?: SheetMedia[];
  note?: string;
  seller?: string;
  date?: string;
  condition?: string;
  range?: string;
  options: SheetOption[];
}

const PLACEHOLDER_NAME = /^(buyer|customer|sample|price check|listing)$/i;

export interface SheetExtras {
  photo?: string | null;
  note?: string;
  sources?: string[];
  adjustment?: Adjustment;
  /** Saved asking price, in cents. Replaces a stale suggested line. */
  askingCents?: number | null;
  seller?: string;
  date?: string;
}

export function buildSheet(quote: QuoteRecord, groups: ItemGroup[], extras: SheetExtras = {}): SharedSheet {
  const adjustment = extras.adjustment ?? adjustmentFromSources(extras.sources ?? []);
  const byId = new Map(groups.map((group) => [group.id, group]));
  const options = quote.tiers.map((tier) => {
    const included = tier.groupIds
      .map((id) => byId.get(id))
      .filter((group): group is ItemGroup => Boolean(group));
    const money = linesAtAsking(
      included.flatMap((group) =>
        group.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      ),
      extras.askingCents ?? null,
      adjustment,
    );
    const lines = money.map((item) => {
      const settled = lineSettlement(item, adjustment);
      return { name: item.name, detail: settled.detail, price: formatUsd(settled.cents) };
    });
    const name = /^(standard|price)$/i.test(tier.name) ? "Asking price" : tier.name;
    return { name, lines, total: formatUsd(settledTotal(money, adjustment)) };
  });
  const subtitle = PLACEHOLDER_NAME.test(quote.customerName.trim()) ? extras.note || "" : quote.customerName;
  return {
    title: quote.title,
    subtitle,
    photo: extras.photo ?? null,
    note: extras.note,
    seller: extras.seller,
    date: extras.date,
    options,
  };
}

/** The sheet a buyer, a printout, and a PDF all share. The discount lives in the guide sources. */
export function buyerSheet(
  quote: QuoteRecord,
  groups: ItemGroup[],
  guide: {
    sources?: string[] | null;
    note?: string | null;
    photo?: string | null;
    seller?: string;
    date?: string;
    askingCents?: number | null;
  } = {},
): SharedSheet {
  return buildSheet(quote, groups, {
    sources: guide.sources ?? [],
    note: guide.note || undefined,
    photo: guide.photo ?? null,
    seller: guide.seller,
    date: guide.date,
    askingCents: guide.askingCents,
  });
}

function isSheet(value: unknown): value is SharedSheet {
  if (!value || typeof value !== "object") return false;
  const row = value as SharedSheet;
  return typeof row.title === "string" && Array.isArray(row.options);
}

export async function publishSheet(
  userId: string,
  quoteId: string,
  sheet: SharedSheet,
): Promise<string | null> {
  if (dataBackend() !== "supabase") return publishLocalSheet(userId, quoteId, sheet);
  const supabase = await createClient();
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  const existing = await supabase
    .from("quotes")
    .select("share_token")
    .eq("id", quoteId)
    .eq("user_id", userId)
    .maybeSingle();
  const current = (existing.data as { share_token?: string | null } | null)?.share_token;
  const next = current || token;
  const { error } = await supabase
    .from("quotes")
    .update({ share_token: next, sheet })
    .eq("id", quoteId)
    .eq("user_id", userId);
  if (error) return null;
  return next;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Shared pages and PDFs never include an email address or other contact text. */
export function stripContact(value: string): string {
  return value.replace(EMAIL, "").replace(/\s{2,}/g, " ").replace(/^[·,\s]+|[·,\s]+$/g, "").trim();
}

/** Buyer-facing sheet: no seller identity, no internal price math, no repeated lines. */
export function forPublic(sheet: SharedSheet): SharedSheet {
  const title = stripContact(sheet.title);
  const note = stripContact(sheet.note || "");
  const subtitle = stripContact(sheet.subtitle);
  const options = sheet.options.map((option) => {
    const lines = option.lines
      .map((line) => ({
        name: stripContact(line.name),
        detail: /[×x]|%|=/.test(line.detail) ? "" : stripContact(line.detail),
        price: line.price,
      }))
      .filter((line) => line.name);
    return { ...option, name: /asking price/i.test(option.name) ? "Asking price" : stripContact(option.name), lines };
  });
  return {
    title,
    subtitle: subtitle && subtitle !== title && subtitle !== note ? subtitle : "",
    photo: sheet.photo ?? null,
    media: publicMedia(sheet.media),
    note: note && note !== title ? note : "",
    date: sheet.date,
    condition: stripContact(sheet.condition || ""),
    range: stripContact(sheet.range || ""),
    options,
  };
}

function publicMedia(media: SheetMedia[] | undefined): SheetMedia[] | undefined {
  if (!media?.length) return undefined;
  const items = media.filter(
    (item) =>
      item &&
      (item.kind === "image" || item.kind === "video") &&
      typeof item.id === "string" &&
      /^[a-zA-Z0-9_-]{1,40}$/.test(item.id),
  );
  return items.length ? items.map((item) => ({ id: item.id, kind: item.kind })) : undefined;
}

async function sellerEmail(token: string): Promise<string | null> {
  if (dataBackend() !== "supabase") {
    const { readLocalShareSeller } = await import("./store/local");
    return readLocalShareSeller(token);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const quote = await service.from("quotes").select("user_id").eq("share_token", token).maybeSingle();
  const userId = (quote.data as { user_id?: string } | null)?.user_id;
  if (!userId) return null;
  const user = await service.auth.admin.getUserById(userId);
  const email = user.data.user?.email || "";
  return email.includes("@") ? email : null;
}

/** Sends a buyer's note to the seller. The address never comes back to the page. */
export async function deliverShareNote(
  token: string,
  note: { name: string; message: string },
): Promise<"sent" | "held" | "missing"> {
  if (!token || token.length > 80) return "missing";
  const sheet = await readSharedSheet(token);
  if (!sheet) return "missing";
  const email = await sellerEmail(token).catch(() => null);
  const message = note.message.replace(/\s+/g, " ").trim().slice(0, 1000);
  if (!message) return "held";
  if (!email) return "held";
  const name = note.name.replace(/\s+/g, " ").trim().slice(0, 80) || "Someone";
  const result = await sendSupportEmail({
    to: email,
    subject: `A note about ${sheet.title}`.slice(0, 180),
    text: `${name} wrote about a Price Ranger price:\n\n${message}\n`,
  });
  return result.sent ? "sent" : "held";
}

/** Who published this share. Used to stream their photos. Never send this to the browser. */
export async function readShareOwner(token: string): Promise<{ userId: string; quoteId: string } | null> {
  if (!token || token.length > 80) return null;
  if (dataBackend() !== "supabase") {
    const { readLocalShareOwner } = await import("./store/local");
    return readLocalShareOwner(token);
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  const { createClient: createService } = await import("@supabase/supabase-js");
  const service = createService(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const quote = await service.from("quotes").select("id, user_id").eq("share_token", token).maybeSingle();
  const row = quote.data as { id?: string; user_id?: string } | null;
  if (!row?.id || !row.user_id) return null;
  return { userId: row.user_id, quoteId: row.id };
}

export async function readSharedSheet(token: string): Promise<SharedSheet | null> {
  if (!token || token.length > 80) return null;
  if (dataBackend() !== "supabase") {
    const payload = await readLocalSheet(token);
    return isSheet(payload) ? payload : null;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shared_sheet", { token });
  if (error || !isSheet(data)) return null;
  return data;
}
