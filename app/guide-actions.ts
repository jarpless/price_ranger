"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser, safeNext } from "@/lib/auth";
import { confirmPlusCheckout, createPlusCheckout, stripeTestKey } from "@/lib/billing";
import { dataBackend, siteOriginFromHeaders } from "@/lib/env";
import { clip } from "@/lib/form";
import { pricingAccess } from "@/lib/guide/access";
import { TOS_VERSION } from "@/lib/guide/config";
import { isGuidePath, suggestPrice } from "@/lib/guide/flow";
import { photoDataUrl, readPendingPhoto, readQuotePhoto, savePendingPhoto, saveQuotePhoto } from "@/lib/guide/photos";
import { adjustmentFromSources, looksLikeFilename, settledTotal, withAdjustment, type Adjustment } from "@/lib/guide/pricing";
import { identifyPhoto } from "@/lib/guide/vision";
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
import { PLAN_PRICES_CENTS } from "@/lib/plans";
import { buildSheet, publishSheet } from "@/lib/share";
import { getData } from "@/lib/store";
import { addLocalPaidCents, setLocalPlan } from "@/lib/store/local";
import type { SessionUser } from "@/lib/types";

function refresh() {
  revalidatePath("/", "layout");
}

async function quoteLines(userId: string, quoteId: string) {
  const data = await getData();
  const quote = await data.getQuote(userId, quoteId);
  if (!quote) return [];
  const groups = await data.listGroups(userId);
  const byId = new Map(groups.map((group) => [group.id, group]));
  return (quote.tiers[0]?.groupIds ?? []).flatMap((id) => byId.get(id)?.items ?? []).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
  }));
}

async function settledPrice(userId: string, quoteId: string, adjustment: Adjustment): Promise<number> {
  return settledTotal(await quoteLines(userId, quoteId), adjustment);
}

async function photoFromForm(userId: string, formData: FormData): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 32) {
    return { bytes: new Uint8Array(await photo.arrayBuffer()), mime: photo.type || "image/jpeg" };
  }
  return readPendingPhoto(userId);
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
  redirect(safeNext(clip(formData.get("next"), 200)));
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
  const photo = await photoFromForm(user.id, formData);
  if (!description && !photo) redirect("/new?error=missing");
  let text = description;
  let visionNote = "";
  if (!text && photo) {
    const identified = await identifyPhoto(photo.bytes, photo.mime);
    if (!identified || looksLikeFilename(identified.title)) {
      await savePendingPhoto(user.id, photo.bytes, photo.mime);
      redirect("/new?error=photo");
    }
    text = identified.title;
    visionNote = identified.note;
  }
  if (!text || looksLikeFilename(text)) redirect("/new?error=photo");
  const suggestion = suggestPrice(text, path);
  if (visionNote) suggestion.note = visionNote;
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
    photoName: photo ? "photo" : null,
    sharedAt: null,
    shareToken: null,
    outcome: null,
    sample: false,
    finishedAt: null,
    updatedAt: new Date().toISOString(),
  });
  if (photo) await saveQuotePhoto(user.id, quoteId, photo.bytes, photo.mime);
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
  const uploaded = await photoFromForm(user.id, formData);
  if (!description && !uploaded && !row.photoName) redirect(`/guide/${quoteId}?error=missing`);
  let text = description;
  let visionNote = "";
  if (!text && uploaded) {
    const identified = await identifyPhoto(uploaded.bytes, uploaded.mime);
    if (!identified || looksLikeFilename(identified.title)) {
      await savePendingPhoto(user.id, uploaded.bytes, uploaded.mime);
      redirect(`/guide/${quoteId}?error=photo`);
    }
    text = identified.title;
    visionNote = identified.note;
  }
  if (!text || looksLikeFilename(text)) redirect(`/guide/${quoteId}?error=photo`);
  const suggestion = suggestPrice(text, path);
  if (visionNote) suggestion.note = visionNote;
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
    photoName: uploaded || row.photoName ? "photo" : null,
    priceCents: suggestion.cents,
    note: suggestion.note,
    sources: suggestion.sources,
    step: "review",
  });
  if (uploaded) await saveQuotePhoto(user.id, quoteId, uploaded.bytes, uploaded.mime);
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
  let sources = row.sources;
  if (kind === "discount") {
    const raw = clip(formData.get("percent"), 8);
    const percent = Number(raw);
    if (!/^\d{1,3}$/.test(raw) || !Number.isFinite(percent) || percent <= 0 || percent > 100) {
      redirect(`/guide/${quoteId}?error=percent`);
    }
    sources = withAdjustment(sources, {
      percent,
      includeFees: formData.get("includeFees") === "on",
    });
  } else if (kind === "fee" || kind === "line") {
    const name = kind === "fee" ? "Fee" : clip(formData.get("name"), 80);
    const amount = parseDollarsToCents(clip(formData.get("amount"), 20));
    if (!name || amount == null) redirect(`/guide/${quoteId}?error=${kind === "fee" ? "fee" : "line"}`);
    const quote = await data.getQuote(user.id, quoteId);
    const groups = await data.listGroups(user.id);
    const groupId = quote?.tiers[0]?.groupIds[0];
    const group = groups.find((item) => item.id === groupId);
    if (!groupId || !group) redirect(`/guide/${quoteId}?error=${kind === "fee" ? "fee" : "line"}`);
    const itemId = await data.createCustomItem(user.id, { name, unit: "each", unitPriceCents: amount });
    await data.addGroupItem(user.id, groupId, itemId);
  }
  const priceCents = await settledPrice(user.id, quoteId, adjustmentFromSources(sources));
  await saveGuideQuote({ ...row, sources, priceCents, step: "adjust" });
  refresh();
  redirect(`/guide/${quoteId}`);
}

export async function sendQuote(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const row = await requireGuide(user.id, quoteId);
  const data = await getData();
  const quote = await data.getQuote(user.id, quoteId);
  if (!quote) redirect("/");
  const groups = await data.listGroups(user.id);
  const photo = row.photoName ? await readQuotePhoto(user.id, quoteId) : null;
  const token = await publishSheet(
    user.id,
    quoteId,
    buildSheet(quote, groups, {
      sources: row.sources,
      note: row.note,
      photo: photo ? photoDataUrl(photo) : null,
    }),
  );
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
  const { deleteSignedInAccount } = await import("@/lib/account/delete");
  const result = await deleteSignedInAccount(user.id);
  if (!result.ok) redirect("/settings?privacy=delete-failed");
  redirect("/login?notice=deleted");
}

export async function startCheckout() {
  const user = await requireUser();
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "upgrade_viewed", { variant: guide.variant, source: "checkout" });
  if (!stripeTestKey()) redirect("/upgrade");
  const origin = siteOriginFromHeaders(await headers());
  let url = "";
  try {
    url = await createPlusCheckout({
      userId: user.id,
      email: user.email,
      origin,
    });
  } catch {
    redirect("/upgrade");
  }
  redirect(url);
}

export async function finishCheckout(sessionId: string) {
  const user = await requireUser();
  const paid = await confirmPlusCheckout(sessionId, user.id);
  if (!paid) return false;
  if (dataBackend() === "local") {
    await setLocalPlan(user.id, "plus", null);
    await addLocalPaidCents(user.id, PLAN_PRICES_CENTS.plusMonth);
  } else if (dataBackend() === "supabase") {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) return false;
    const { createClient } = await import("@supabase/supabase-js");
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const current = await service.from("profiles").select("paid_cents").eq("id", user.id).maybeSingle();
    const paid = Number((current.data as { paid_cents?: number } | null)?.paid_cents ?? 0);
    let { error } = await service.from("profiles").update({ plan: "plus", paid_cents: paid + PLAN_PRICES_CENTS.plusMonth }).eq("id", user.id);
    if (error && /paid_cents|schema cache|does not exist/i.test(error.message)) {
      const retry = await service.from("profiles").update({ plan: "plus" }).eq("id", user.id);
      error = retry.error;
    }
    if (error) throw new Error(error.message);
  }
  const guide = await ensureGuideUser(user.id);
  await recordFunnel(user.id, "checkout_completed", { plan: "plus", variant: guide.variant });
  refresh();
  return true;
}

