"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { parsePriceCsv } from "@/lib/csv";
import { isOwnerEmail } from "@/lib/owner";
import { parseDollarsToCents, parseQuantity } from "@/lib/money";
import { getData } from "@/lib/store";
import { addHistory, metaFor } from "@/lib/feedback/desk";
import { sendSupportEmail, statusEmail } from "@/lib/feedback/mail";
import { getFeedbackById, updateFeedback, type FeedbackStatus } from "@/lib/store/basecamp";
import { isUnit } from "@/lib/units";

function refresh() {
  revalidatePath("/", "layout");
}

export async function saveFeedbackStatus(id: string, formData: FormData) {
  const user = await requireUser();
  if (!isOwnerEmail(user.email)) redirect("/");
  const status = String(formData.get("status") || "") as FeedbackStatus;
  const shippedIn = String(formData.get("shippedIn") || "");
  const allowed: FeedbackStatus[] = ["new", "planned", "in_progress", "shipped"];
  if (!allowed.includes(status)) return;
  const before = await getFeedbackById(id);
  if (!before) return;
  const shipped = status === "shipped" ? shippedIn.slice(0, 40) : null;
  const saved = await updateFeedback(user.id, id, { status, shippedIn: shipped }, "any");
  if (!saved || before.status === status) {
    refresh();
    return;
  }
  await addHistory({
    feedbackId: id,
    actorId: user.id,
    fromStatus: before.status,
    toStatus: status,
    note: shipped ? `Shipped in ${shipped}.` : "",
  });
  const meta = await metaFor(id);
  await sendSupportEmail({
    to: meta?.email || "",
    subject: `Your note is now ${status.replace("_", " ")}`,
    text: statusEmail({ summary: meta?.summary || before.body, status, shippedIn: shipped }),
  });
  refresh();
}

export async function patchLibraryItem(input: {
  id: string;
  name: string;
  unit: string;
  price: string;
}) {
  const user = await requireUser();
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 120);
  const cents = parseDollarsToCents(input.price);
  if (!name || !isUnit(input.unit) || cents == null) {
    return { ok: false as const, error: "Check the name, unit, and price." };
  }
  const ok = await (await getData()).updateLibraryItem(user.id, input.id, {
    name,
    unit: input.unit,
    unitPriceCents: cents,
  });
  refresh();
  return ok ? { ok: true as const } : { ok: false as const, error: "That price is not in your library." };
}

export async function setCatalogPrice(skuId: string, price: string) {
  const user = await requireUser();
  const cents = parseDollarsToCents(price);
  if (cents == null) return { ok: false as const, error: "Enter a price like 135 or 12.50." };
  const data = await getData();
  const existing = (await data.listLibrary(user.id)).find((item) => item.skuId === skuId);
  if (!existing) {
    const added = await data.addSkuToLibrary(user.id, skuId);
    if (added === "missing") return { ok: false as const, error: "That catalog row is not available." };
  }
  const owned = (await data.listLibrary(user.id)).find((item) => item.skuId === skuId);
  if (!owned) return { ok: false as const, error: "Could not add that product." };
  await data.updateLibraryItem(user.id, owned.id, {
    name: owned.name,
    unit: owned.unit,
    unitPriceCents: cents,
  });
  refresh();
  return { ok: true as const };
}

export async function importPriceCsv(csv: string) {
  const user = await requireUser();
  const parsed = parsePriceCsv(csv);
  if (parsed.errors.length && parsed.rows.length === 0) {
    return { ok: false as const, added: 0, errors: parsed.errors };
  }
  const data = await getData();
  const plain = parsed.rows.filter((row) => !row.sku);
  const addedPlain = await data.importLibraryRows(
    user.id,
    plain.map((row) => ({ name: row.name, unit: row.unit, unitPriceCents: row.unitPriceCents })),
  );
  let linked = 0;
  const catalog = await data.listCatalog();
  for (const row of parsed.rows) {
    if (!row.sku) continue;
    const hit = catalog.find((item) => item.skuCode?.toLowerCase() === row.sku?.toLowerCase());
    if (!hit) {
      parsed.errors.push(`No catalog SKU matches ${row.sku}.`);
      continue;
    }
    await data.addSkuToLibrary(user.id, hit.id);
    const owned = (await data.listLibrary(user.id)).find((item) => item.skuId === hit.id);
    if (!owned) continue;
    await data.updateLibraryItem(user.id, owned.id, {
      name: owned.name,
      unit: owned.unit,
      unitPriceCents: row.unitPriceCents,
    });
    linked += 1;
  }
  refresh();
  return { ok: true as const, added: addedPlain + linked, errors: parsed.errors };
}

export async function dropPriceOnGroup(groupId: string, libraryItemId: string) {
  const user = await requireUser();
  const ok = await (await getData()).addGroupItem(user.id, groupId, libraryItemId);
  refresh();
  return ok;
}

export async function dropGroupOnTier(tierId: string, groupId: string) {
  const user = await requireUser();
  const ok = await (await getData()).toggleTierGroup(user.id, tierId, groupId);
  refresh();
  return ok;
}

export async function quickCreateGroup(name: string) {
  const user = await requireUser();
  const cleaned = name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!cleaned) return { ok: false as const, id: "" };
  const id = await (await getData()).createGroup(user.id, cleaned);
  refresh();
  return { ok: true as const, id };
}

export async function deleteLibraryPrice(id: string) {
  const user = await requireUser();
  const ok = await (await getData()).deleteLibraryItem(user.id, id);
  refresh();
  return ok;
}

export async function removeQuoteLine(itemId: string) {
  const user = await requireUser();
  const ok = await (await getData()).removeGroupItem(user.id, itemId);
  refresh();
  return ok;
}

export async function patchGroupLine(input: { itemId: string; quantity: string; price: string }) {
  const user = await requireUser();
  const quantity = parseQuantity(input.quantity);
  const cents = parseDollarsToCents(input.price);
  if (quantity == null || cents == null) return { ok: false as const };
  const ok = await (await getData()).updateGroupItem(user.id, input.itemId, {
    quantity,
    unitPriceCents: cents,
  });
  refresh();
  return { ok };
}
