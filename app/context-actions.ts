"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { draftLines, draftTotalCents, normalizeDraft } from "@/lib/context/draft";
import { pricingAccess } from "@/lib/guide/access";
import { suggestPrice } from "@/lib/guide/suggest";
import { ensureGuideUser, recordFunnel, saveGuideQuote } from "@/lib/guide/store";
import { marketPrice, withOverride } from "@/lib/market";
import { guideDraftHref } from "@/lib/search-return";
import { getData } from "@/lib/store";

export type SaveContextResult = { ok: true; href: string } | { ok: false; error: "limit" | "empty" | "price" | "save" };

/** Saves a reviewed draft. Only the edited lines are stored; the files themselves never are. */
export async function saveContextDraft(json: string): Promise<SaveContextResult> {
  const user = await requireUser();
  const access = await pricingAccess(user);
  if (!access.ok) return { ok: false, error: "limit" };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(json).slice(0, 200_000));
  } catch {
    return { ok: false, error: "empty" };
  }
  const draft = normalizeDraft(parsed);
  const lines = draftLines(draft);
  if (!lines.length) return { ok: false, error: "empty" };
  const data = await getData();
  const guide = await ensureGuideUser(user.id);
  const title = draft.title.slice(0, 80);
  const from = draft.sources.length ? `From ${draft.sources.slice(0, 3).join(", ")}${draft.sources.length > 3 ? " and more" : ""}` : "From what you added";

  try {
    if (draft.format === "item") {
      const price = lines.length === 1 ? Math.round((lines[0].unitPriceCents ?? 0) * lines[0].quantity) : draftTotalCents(draft);
      if (!price) return { ok: false, error: "price" };
      const quoteId = await data.createQuote(user.id, { title, customerName: draft.customerName || "Buyer" });
      const groupId = await data.createGroup(user.id, title);
      const itemId = await data.createCustomItem(user.id, { name: title, unit: "each", unitPriceCents: price });
      await data.addGroupItem(user.id, groupId, itemId);
      const quote = await data.getQuote(user.id, quoteId);
      const tierId = quote?.tiers[0]?.id;
      if (tierId) await data.toggleTierGroup(user.id, tierId, groupId);
      let sources: string[];
      if (marketPrice(title)) {
        const market = suggestPrice(title, "item");
        sources = [from, ...withOverride(market.sources, price === market.cents ? null : price)];
      } else {
        sources = [from];
        if (draft.lowCents && draft.highCents) sources.push(`meta:low=${draft.lowCents}`, `meta:high=${draft.highCents}`);
        sources.push(`meta:confidence=${draft.confidence}`, `meta:suggested=${price}`);
      }
      await saveGuideQuote({
        quoteId,
        userId: user.id,
        path: "item",
        step: "review",
        description: title,
        priceCents: price,
        note: draft.summary || `${from}.`,
        sources,
        photoName: null,
        sharedAt: null,
        shareToken: null,
        outcome: null,
        sample: false,
        finishedAt: null,
        updatedAt: new Date().toISOString(),
      });
      await recordFunnel(user.id, "first_price_generated", { path: "item", source: "context", variant: guide.variant }).catch(() => undefined);
      revalidatePath("/", "layout");
      return { ok: true, href: guideDraftHref(quoteId, title, null) };
    }

    const quoteId = await data.createQuote(user.id, { title, customerName: draft.customerName || "Customer" });
    const quote = await data.getQuote(user.id, quoteId);
    const tierId = quote?.tiers[0]?.id;
    for (const section of draft.sections) {
      if (!section.lines.length) continue;
      const groupId = await data.createGroup(user.id, section.name.slice(0, 80));
      const added: { itemId: string; quantity: number; unitPriceCents: number }[] = [];
      for (const line of section.lines) {
        const unitPriceCents = line.unitPriceCents ?? 0;
        const itemId = await data.createCustomItem(user.id, { name: line.name, unit: line.unit, unitPriceCents });
        await data.addGroupItem(user.id, groupId, itemId);
        added.push({ itemId, quantity: line.quantity, unitPriceCents });
      }
      const group = await data.getGroup(user.id, groupId);
      for (const entry of added) {
        const row = group?.items.find((item) => item.libraryItemId === entry.itemId);
        if (row && entry.quantity !== 1) await data.updateGroupItem(user.id, row.id, { quantity: entry.quantity, unitPriceCents: entry.unitPriceCents });
      }
      if (tierId) await data.toggleTierGroup(user.id, tierId, groupId);
    }
    await recordFunnel(user.id, "first_price_generated", { path: "job", source: "context", variant: guide.variant }).catch(() => undefined);
    revalidatePath("/", "layout");
    return { ok: true, href: `/quotes/${quoteId}` };
  } catch {
    return { ok: false, error: "save" };
  }
}
