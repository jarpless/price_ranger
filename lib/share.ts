import { dataBackend } from "./env";
import { formatUsd, lineTotalCents } from "./money";
import { groupCents } from "./project";
import { publishLocalSheet, readLocalSheet } from "./store/local";
import { createClient } from "./supabase/server";
import type { ItemGroup, QuoteRecord } from "./types";
import { unitWord } from "./units";

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
  options: SheetOption[];
}

export function buildSheet(quote: QuoteRecord, groups: ItemGroup[]): SharedSheet {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const options = quote.tiers.map((tier) => {
    const included = tier.groupIds
      .map((id) => byId.get(id))
      .filter((group): group is ItemGroup => Boolean(group));
    const lines = included.flatMap((group) =>
      group.items.map((item) => ({
        name: item.name,
        detail: `${item.quantity} ${unitWord(item.unit, item.quantity)}`,
        price: formatUsd(lineTotalCents(item.quantity, item.unitPriceCents)),
      })),
    );
    const total = included.reduce((sum, group) => sum + groupCents(group), 0);
    return { name: tier.name, lines, total: formatUsd(total) };
  });
  return {
    title: quote.title,
    subtitle: quote.customerName,
    options,
  };
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
