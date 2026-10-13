"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { confirmPlusCheckout, createPlusCheckout } from "@/lib/billing";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";
import { clip } from "@/lib/form";
import { pricingAccess } from "@/lib/guide/access";
import { TOS_VERSION } from "@/lib/guide/config";
import { applyDiscount, isGuidePath, suggestPrice } from "@/lib/guide/flow";
import {
  ensureGuideUser,
  getGuideQuote,
  listGuideQuotes,
  recordFunnel,
  saveGuideQuote,
  saveGuideUser,
  type GuideQuote as StoredGuideQuote,
} from "@/lib/guide/store";
import { parseDollarsToCents } from "@/lib/money";
import { liveTierTotals } from "@/lib/project";
import { buildSheet, publishSheet } from "@/lib/share";
import { getData } from "@/lib/store";
import { setLocalPlan } from "@/lib/store/local";
import type { SessionUser } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

async function pricedQuote(userId: string, quoteId: string): Promise<number> {
  const data = await getData();
  const quote = await data.getQuote(userId, quoteId);
  if (!quote) return 0;
  const groups = await data.listGroups(userId);
  return liveTierTotals(quote, groups)[0] ?? 0;
}

async function blockNewPrice(user: SessionUser) {
  const access = await pricingAccess(user);
  if (!access.ok) redirect("/upgrade");
}

export async function acceptTerms(formData: FormData) {
  const user = await requireUser();
  if (formData.get("acceptTerms") !== "on") redirect("/welcome?error=terms");
  const guide = await ensureGuideUser(user.id);
  const now = new Date().toISOString();
  guide.tosVersion = TOS_VERSION;
  guide.tosAcceptedAt = now;
  guide.introCompletedAt = now;
  guide.trialStartedAt = guide.trialStartedAt || now;
  await saveGuideUser(guide);
  await recordFunnel(user.id, "terms_accepted", { version: TOS_VERSION, variant: guide.variant });
  refresh();
  redirect("/");
}

export async function choosePath(formData: FormData) {
  const user = await requireUser();
  await blockNewPrice(user);
  const path = clip(formData.get("path"), 20);
  if (!isGuidePath(path)) redirect("/new");
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "path_chosen", { path, variant: guide.variant });
  const customer = path === "job" ? "Customer" : path === "check" ? "Price check" : "Buyer";
  const title = path === "job" ? "New job" : path === "check" ? "Price check" : "Item for sale";
  const data = await getData();
  const quoteId = await data.createQuote(user.id, { title, customerName: customer });
  const groupId = await data.createGroup(user.id, title);
  const itemId = await data.createCustomItem(user.id, {
    name: title,
    unit: "each",
    unitPriceCents: 0,
  });
  await data.addGroupItem(user.id, groupId, itemId);
  const quote = await data.getQuote(user.id, quoteId);
  const tierId = quote?.tiers[0]?.id;
  if (tierId) await data.toggleTierGroup(user.id, tierId, groupId);
  const row: StoredGuideQuote = {
    quoteId,
    userId: user.id,
    path,
    step: "describe",
    description: "",
    priceCents: null,
    note: "",
    sources: [],
    photoName: null,
    sharedAt: null,
    shareToken: null,
    outcome: null,
    sample: false,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  };
  await saveGuideQuote(row);
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function startAndPrice(formData: FormData) {
  const user = await requireUser();
  await blockNewPrice(user);
  const path = clip(formData.get("path"), 20);
  if (!isGuidePath(path)) redirect("/new");
  const description = clip(formData.get("description"), 280);
  const photo = formData.get("photo");
  const photoName = photo instanceof File && photo.size > 0 ? photo.name.slice(0, 120) : null;
  if (!description && !photoName) redirect("/new?error=missing");
  const text = description || photoName || "Item";
  const suggestion = suggestPrice(text, path);
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "path_chosen", { path, variant: guide.variant });
  const customer = path === "job" ? "Customer" : path === "check" ? "Price check" : "Buyer";
  const data = await getData();
  const quoteId = await data.createQuote(user.id, { title: text.slice(0, 80), customerName: customer });
  const groupId = await data.createGroup(user.id, text.slice(0, 80));
  const itemId = await data.createCustomItem(user.id, {
    name: text.slice(0, 80),
    unit: "each",
    unitPriceCents: suggestion.cents,
  });
  await data.addGroupItem(user.id, groupId, itemId);
  const quote = await data.getQuote(user.id, quoteId);
  const tierId = quote?.tiers[0]?.id;
  if (tierId) await data.toggleTierGroup(user.id, tierId, groupId);
  await saveGuideQuote({
    quoteId,
    userId: user.id,
    path,
    step: "review",
    description: text,
    priceCents: suggestion.cents,
    note: suggestion.note,
    sources: suggestion.sources,
    photoName,
    sharedAt: null,
    shareToken: null,
    outcome: null,
    sample: false,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  });
  await recordFunnel(user.id, "first_price_generated", { path, variant: guide.variant });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function startSample() {
  const user = await requireUser();
  const existing = (await listGuideQuotes(user.id)).find((quote) => quote.sample);
  if (existing) redirect(`/guide/${existing.quoteId}`);
  const suggestion = suggestPrice("Oak dining table", "item");
  const data = await getData();
  const quoteId = await data.createQuote(user.id, {
    title: "Oak dining table",
    customerName: "Sample",
  });
  const groupId = await data.createGroup(user.id, "Oak dining table");
  const itemId = await data.createCustomItem(user.id, {
    name: "Oak dining table",
    unit: "each",
    unitPriceCents: suggestion.cents,
  });
  await data.addGroupItem(user.id, groupId, itemId);
  const quote = await data.getQuote(user.id, quoteId);
  const tierId = quote?.tiers[0]?.id;
  if (tierId) await data.toggleTierGroup(user.id, tierId, groupId);
  const guide = await ensureGuideUser(user.id);
  await saveGuideQuote({
    quoteId,
    userId: user.id,
    path: "item",
    step: "review",
    description: "Oak dining table, solid wood",
    priceCents: suggestion.cents,
    note: suggestion.note,
    sources: suggestion.sources,
    photoName: null,
    sharedAt: null,
    shareToken: null,
    outcome: null,
    sample: true,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  });
  await recordFunnel(user.id, "first_price_generated", { sample: "yes", variant: guide.variant });
  refresh();
  redirect(`/guide/${quoteId}`);
}

async function requireGuide(userId: string, quoteId: string) {
  const row = await getGuideQuote(userId, quoteId);
  if (!row) redirect("/");
  return row;
}

export async function saveDescription(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const description = clip(formData.get("description"), 280);
  const pathValue = clip(formData.get("path"), 20);
  const path = isGuidePath(pathValue) ? pathValue : row.path;
  const photo = formData.get("photo");
  const photoName = photo instanceof File && photo.size > 0 ? photo.name.slice(0, 120) : row.photoName;
  if (!description && !photoName) redirect(`/guide/${quoteId}?error=missing`);
  const text = description || photoName || "Item";
  const suggestion = suggestPrice(text, path);
  const data = await getData();
  const quote = await data.getQuote(user.id, quoteId);
  const groups = await data.listGroups(user.id);
  const first = quote?.tiers[0]?.groupIds
    .map((id) => groups.find((group) => group.id === id))
    .find(Boolean);
  const line = first?.items[0];
  if (line) {
    await data.updateGroupItem(user.id, line.id, { quantity: 1, unitPriceCents: suggestion.cents });
    if (line.libraryItemId) {
      await data.updateLibraryItem(user.id, line.libraryItemId, {
        name: text.slice(0, 80),
        unit: line.unit,
        unitPriceCents: suggestion.cents,
      });
    }
  }
  await data.updateQuote(user.id, quoteId, {
    title: text.slice(0, 80),
    customerName: quote?.customerName || "Customer",
  });
  const guide = await ensureGuideUser(user.id);
  await saveGuideQuote({
    ...row,
    path,
    description: text,
    photoName,
    priceCents: suggestion.cents,
    note: suggestion.note,
    sources: suggestion.sources,
    step: "review",
  });
  await recordFunnel(user.id, "first_price_generated", { path: row.path, variant: guide.variant });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function continueGuide(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const next =
    row.step === "review" ? "adjust" : row.step === "adjust" ? "share" : row.step === "share" ? "sold" : row.step;
  await saveGuideQuote({ ...row, step: next });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function applyAdjustment(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const kind = clip(formData.get("kind"), 20);
  const data = await getData();
  if (kind === "discount") {
    const percent = Number(clip(formData.get("percent"), 3));
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) redirect(`/guide/${quoteId}?error=adjust`);
    const quote = await data.getQuote(user.id, quoteId);
    const groups = await data.listGroups(user.id);
    for (const groupId of quote?.tiers[0]?.groupIds ?? []) {
      const group = groups.find((item) => item.id === groupId);
      for (const line of group?.items ?? []) {
        await data.updateGroupItem(user.id, line.id, {
          quantity: line.quantity,
          unitPriceCents: applyDiscount(line.unitPriceCents, percent),
        });
      }
    }
  } else if (kind === "fee" || kind === "line") {
    const name = kind === "fee" ? "Fee" : clip(formData.get("name"), 80);
    const amount = parseDollarsToCents(clip(formData.get("amount"), 20));
    if (!name || amount == null) redirect(`/guide/${quoteId}?error=adjust`);
    const quote = await data.getQuote(user.id, quoteId);
    const groups = await data.listGroups(user.id);
    const groupId = quote?.tiers[0]?.groupIds[0];
    const group = groups.find((item) => item.id === groupId);
    if (!groupId || !group) redirect(`/guide/${quoteId}?error=adjust`);
    const itemId = await data.createCustomItem(user.id, { name, unit: "each", unitPriceCents: amount });
    await data.addGroupItem(user.id, groupId, itemId);
  }
  const priceCents = await pricedQuote(user.id, quoteId);
  await saveGuideQuote({ ...row, priceCents, step: "adjust" });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function sendQuote(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const access = await pricingAccess(user);
  if (!row.sample && !access.ok) redirect("/upgrade");
  const data = await getData();
  const quote = await data.getQuote(user.id, quoteId);
  if (!quote) redirect("/");
  const groups = await data.listGroups(user.id);
  const token = await publishSheet(user.id, quoteId, buildSheet(quote, groups));
  if (!token) redirect(`/guide/${quoteId}?error=share`);
  const guide = await ensureGuideUser(user.id);
  await saveGuideQuote({
    ...row,
    sharedAt: new Date().toISOString(),
    shareToken: token,
    finishedAt: row.finishedAt || new Date().toISOString(),
    step: "share",
  });
  await recordFunnel(user.id, "first_share", { path: row.path, variant: guide.variant });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function markOutcome(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const outcome = formData.get("outcome") === "sold" ? "sold" : "not_yet";
  const guide = await ensureGuideUser(user.id);
  await saveGuideQuote({
    ...row,
    outcome,
    step: "sold",
    finishedAt: row.finishedAt || new Date().toISOString(),
  });
  if (outcome === "sold") {
    await recordFunnel(user.id, "first_mark_sold", { path: row.path, variant: guide.variant });
  }
  refresh();
  redirect(`/guide/${quoteId}?done=1`);
}

export async function setDoNotSell(formData: FormData) {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  guide.ccpaDoNotSell = formData.get("doNotSell") === "on";
  await saveGuideUser(guide);
  refresh();
  redirect("/settings?privacy=saved");
}

export async function requestDeletion() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  guide.deletionRequestedAt = new Date().toISOString();
  await saveGuideUser(guide);
  refresh();
  redirect("/settings?privacy=deletion");
}

export async function startCheckout() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "upgrade_viewed", { variant: guide.variant, source: "checkout" });
  const origin = siteOriginFromHeaders(await headers());
  let url = "";
  try {
    url = await createPlusCheckout({
      userId: user.id,
      email: user.email,
      origin,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout did not start.";
    redirect(`/upgrade?error=${encodeURIComponent(message)}`);
  }
  redirect(url);
}

export async function finishCheckout(sessionId: string) {
  const user = await requireUser();
  const paid = await confirmPlusCheckout(sessionId, user.id);
  if (!paid) return false;
  if (dataBackend() === "local") {
    await setLocalPlan(user.id, "plus", null);
  } else if (dataBackend() === "supabase") {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) return false;
    const { createClient } = await import("@supabase/supabase-js");
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await service.from("profiles").update({ plan: "plus" }).eq("id", user.id);
    if (error) throw new Error(error.message);
  }
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "checkout_completed", { plan: "plus", variant: guide.variant });
  refresh();
  return true;
}

