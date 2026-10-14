"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { requestMagicLink, requireUser, signOutUser } from "@/lib/auth";
import { authErrorPath, classifyAuthError, isNextRedirect } from "@/lib/auth-errors";
import { siteOriginFromHeaders } from "@/lib/env";
import { clip, isEmail } from "@/lib/form";
import { parseDollarsToCents, parseQuantity } from "@/lib/money";
import { buildPresentation } from "@/lib/project";
import { autoSummary } from "@/lib/summary";
import { DEV_CODE_COOKIE, DEV_LINK_COOKIE, PENDING_EMAIL_COOKIE } from "@/lib/session";
import { pricingAccess } from "@/lib/guide/access";
import { getData } from "@/lib/store";
import { isUnit } from "@/lib/units";

function refresh() {
  revalidatePath("/", "layout");
}

export async function sendMagicLink(formData: FormData) {
  const email = clip(formData.get("email"), 160).toLowerCase();
  if (!isEmail(email)) redirect("/signin?error=email");

  const origin = siteOriginFromHeaders(await headers());
  let result: Awaited<ReturnType<typeof requestMagicLink>>;
  const cookieStore = await cookies();
  cookieStore.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 15,
  });
  try {
    result = await requestMagicLink(email, origin);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect(authErrorPath(classifyAuthError(error)));
  }
  if (result.error) redirect(authErrorPath(result.error));
  if (result.devLink) {
    cookieStore.set(DEV_LINK_COOKIE, result.devLink, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 15,
    });
  }
  if (result.devCode) {
    cookieStore.set(DEV_CODE_COOKIE, result.devCode, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 60 * 15,
    });
  }
  redirect("/signin/sent");
}

export async function signOut() {
  await signOutUser();
  redirect("/signin");
}

export async function createQuote(formData: FormData) {
  const user = await requireUser();
  const access = await pricingAccess(user);
  if (!access.ok) redirect("/upgrade");
  const customerName = clip(formData.get("customerName"), 80);
  const title = clip(formData.get("title"), 80);
  if (!customerName || !title) redirect("/quotes/new?error=missing");
  const id = await (await getData()).createQuote(user.id, { customerName, title });
  refresh();
  redirect(`/quotes/${id}`);
}

export async function updateQuote(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  const customerName = clip(formData.get("customerName"), 80);
  const title = clip(formData.get("title"), 80);
  if (!customerName || !title) redirect(`/quotes/${quoteId}?error=missing`);
  await (await getData()).updateQuote(user.id, quoteId, { customerName, title });
  refresh();
  redirect(`/quotes/${quoteId}`);
}

export async function deleteQuote(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  if (formData.get("confirm") !== "on") redirect(`/quotes/${quoteId}?error=confirm`);
  await (await getData()).deleteQuote(user.id, quoteId);
  refresh();
  redirect("/");
}

export async function addTier(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  await (await getData()).addTier(user.id, quoteId);
  refresh();
  redirect(`/quotes/${quoteId}`);
}

export async function useGoodBetterBest(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  await (await getData()).useGoodBetterBest(user.id, quoteId);
  refresh();
  redirect(`/quotes/${quoteId}`);
}

export async function updateTier(formData: FormData) {
  const user = await requireUser();
  const tierId = clip(formData.get("tierId"), 80);
  const quoteId = clip(formData.get("quoteId"), 80);
  const name = clip(formData.get("name"), 40);
  const note = clip(formData.get("note"), 200);
  if (!name) redirect(`/quotes/${quoteId}/tiers/${tierId}?error=name`);
  await (await getData()).updateTier(user.id, tierId, { name, note });
  refresh();
  redirect(`/quotes/${quoteId}/tiers/${tierId}`);
}

export async function setRecommended(formData: FormData) {
  const user = await requireUser();
  const tierId = clip(formData.get("tierId"), 80);
  const quoteId = clip(formData.get("quoteId"), 80);
  const recommended = formData.get("recommended") === "yes";
  await (await getData()).setRecommended(user.id, tierId, recommended);
  refresh();
  redirect(`/quotes/${quoteId}/tiers/${tierId}`);
}

export async function toggleTierGroup(formData: FormData) {
  const user = await requireUser();
  const tierId = clip(formData.get("tierId"), 80);
  const quoteId = clip(formData.get("quoteId"), 80);
  const groupId = clip(formData.get("groupId"), 80);
  await (await getData()).toggleTierGroup(user.id, tierId, groupId);
  refresh();
  redirect(`/quotes/${quoteId}/tiers/${tierId}`);
}

export async function deleteTier(formData: FormData) {
  const user = await requireUser();
  const tierId = clip(formData.get("tierId"), 80);
  const quoteId = clip(formData.get("quoteId"), 80);
  if (formData.get("confirm") !== "on") {
    redirect(`/quotes/${quoteId}/tiers/${tierId}?error=confirm`);
  }
  await (await getData()).deleteTier(user.id, tierId);
  refresh();
  redirect(`/quotes/${quoteId}`);
}

export async function presentQuote(formData: FormData) {
  const user = await requireUser();
  const quoteId = clip(formData.get("quoteId"), 80);
  if (user.guest) redirect(`/signin?reason=save&next=/quotes/${quoteId}`);
  const data = await getData();
  const quote = await data.getQuote(user.id, quoteId);
  if (!quote) redirect("/");
  if (quote.tiers.length === 0) redirect(`/quotes/${quoteId}?error=options`);
  const groups = await data.listGroups(user.id);
  await data.saveSnapshot(user.id, quoteId, buildPresentation(quote, groups));
  refresh();
  redirect(`/quotes/${quoteId}/present`);
}

export async function createCustomItem(formData: FormData) {
  const user = await requireUser();
  const name = clip(formData.get("name"), 120);
  const unit = clip(formData.get("unit"), 20);
  const price = parseDollarsToCents(clip(formData.get("price"), 20));
  if (!name || !isUnit(unit)) redirect("/library?error=missing");
  if (price == null) redirect("/library?error=price");
  await (await getData()).createCustomItem(user.id, { name, unit, unitPriceCents: price });
  refresh();
  redirect("/library");
}

export async function addCatalogSku(formData: FormData) {
  const user = await requireUser();
  const skuId = clip(formData.get("skuId"), 80);
  const query = clip(formData.get("q"), 80);
  const result = await (await getData()).addSkuToLibrary(user.id, skuId);
  refresh();
  const flag = result === "added" ? "added" : result;
  redirect(`/library?q=${encodeURIComponent(query)}&notice=${flag}`);
}

export async function updateLibraryItem(formData: FormData) {
  const user = await requireUser();
  const itemId = clip(formData.get("itemId"), 80);
  const name = clip(formData.get("name"), 120);
  const unit = clip(formData.get("unit"), 20);
  const price = parseDollarsToCents(clip(formData.get("price"), 20));
  if (!name || !isUnit(unit)) redirect(`/library/${itemId}?error=missing`);
  if (price == null) redirect(`/library/${itemId}?error=price`);
  await (await getData()).updateLibraryItem(user.id, itemId, {
    name,
    unit,
    unitPriceCents: price,
  });
  refresh();
  redirect("/library");
}

export async function deleteLibraryItem(formData: FormData) {
  const user = await requireUser();
  const itemId = clip(formData.get("itemId"), 80);
  if (formData.get("confirm") !== "on") redirect(`/library/${itemId}?error=confirm`);
  await (await getData()).deleteLibraryItem(user.id, itemId);
  refresh();
  redirect("/library");
}

export async function createGroup(formData: FormData) {
  const user = await requireUser();
  const name = clip(formData.get("name"), 80);
  if (!name) redirect("/library/groups/new?error=name");
  const id = await (await getData()).createGroup(user.id, name);
  refresh();
  redirect(`/library/groups/${id}`);
}

export async function updateGroupName(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  const name = clip(formData.get("name"), 80);
  if (!name) redirect(`/library/groups/${groupId}?error=name`);
  await (await getData()).updateGroupName(user.id, groupId, name);
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function saveGroupSummary(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  const summary = clip(formData.get("summary"), 600);
  if (!summary) redirect(`/library/groups/${groupId}?error=missing`);
  const data = await getData();
  const group = await data.getGroup(user.id, groupId);
  if (!group) redirect("/library/groups");
  if (summary === autoSummary(group.items)) {
    await data.resetGroupSummary(user.id, groupId);
  } else {
    await data.saveGroupSummary(user.id, groupId, summary);
  }
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function resetGroupSummary(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  await (await getData()).resetGroupSummary(user.id, groupId);
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function addGroupItem(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  const libraryItemId = clip(formData.get("libraryItemId"), 80);
  if (!libraryItemId) redirect(`/library/groups/${groupId}?error=missing`);
  await (await getData()).addGroupItem(user.id, groupId, libraryItemId);
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function updateGroupItem(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  const itemId = clip(formData.get("itemId"), 80);
  const quantity = parseQuantity(clip(formData.get("quantity"), 20));
  const price = parseDollarsToCents(clip(formData.get("price"), 20));
  if (quantity == null) redirect(`/library/groups/${groupId}?error=quantity`);
  if (price == null) redirect(`/library/groups/${groupId}?error=price`);
  await (await getData()).updateGroupItem(user.id, itemId, {
    quantity,
    unitPriceCents: price,
  });
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function removeGroupItem(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  const itemId = clip(formData.get("itemId"), 80);
  await (await getData()).removeGroupItem(user.id, itemId);
  refresh();
  redirect(`/library/groups/${groupId}`);
}

export async function deleteGroup(formData: FormData) {
  const user = await requireUser();
  const groupId = clip(formData.get("groupId"), 80);
  if (formData.get("confirm") !== "on") redirect(`/library/groups/${groupId}?error=confirm`);
  await (await getData()).deleteGroup(user.id, groupId);
  refresh();
  redirect("/library/groups");
}

export async function connectCatalog(formData: FormData) {
  const user = await requireUser();
  const slug = clip(formData.get("slug"), 40);
  const added = await (await getData()).connectConnector(user.id, slug);
  refresh();
  if (added == null) redirect("/catalogs?notice=unavailable");
  redirect(`/catalogs?notice=added&count=${added}&slug=${encodeURIComponent(slug)}`);
}
