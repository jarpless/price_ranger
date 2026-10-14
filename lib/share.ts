import { dataBackend } from "./env";
import { adjustmentFromSources, lineSettlement, settledTotal, type Adjustment } from "./guide/pricing";
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

export interface SharedSheet {
  title: string;
  subtitle: string;
  photo?: string | null;
  note?: string;
  seller?: string;
  date?: string;
  options: SheetOption[];
}

const PLACEHOLDER_NAME = /^(buyer|customer|sample|price check|listing)$/i;

export interface SheetExtras {
  photo?: string | null;
  note?: string;
  sources?: string[];
  adjustment?: Adjustment;
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
    const money = included.flatMap((group) =>
      group.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
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
  guide: { sources?: string[] | null; note?: string | null; photo?: string | null; seller?: string; date?: string } = {},
): SharedSheet {
  return buildSheet(quote, groups, {
    sources: guide.sources ?? [],
    note: guide.note || undefined,
    photo: guide.photo ?? null,
    seller: guide.seller,
    date: guide.date,
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
