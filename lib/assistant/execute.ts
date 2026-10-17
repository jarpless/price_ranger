import { parsePriceCsv } from "../csv";
import { clip } from "../form";
import { adjustmentFromSources, settledTotal } from "../guide/pricing";
import { ensureGuideUser, getGuideQuote, recordFunnel, saveGuideQuote } from "../guide/store";
import { formatUsd, lineTotalCents, parseDollarsToCents } from "../money";
import { withOverride } from "../market";
import { buildPresentation } from "../project";
import { getData } from "../store";
import { isUnit } from "../units";
import { isToolName, normalizeUnit, safeInternalPath, type ToolName } from "./tools";

export interface ToolEffect {
  ok: boolean;
  summary: string;
  href: string;
  spotlight: string;
}

function textArg(args: Record<string, string>, key: string, max = 120): string {
  return clip(args[key] ?? "", max);
}

export async function executeTool(
  userId: string,
  name: string,
  args: Record<string, string>,
): Promise<ToolEffect> {
  if (!isToolName(name)) {
    return { ok: false, summary: "That action is not available.", href: "/", spotlight: "new-quote" };
  }
  const data = await getData();
  switch (name as ToolName) {
    case "navigate": {
      const href = safeInternalPath(textArg(args, "path", 200)) || "/";
      return { ok: true, summary: `Opened ${href}.`, href, spotlight: "new-quote" };
    }
    case "create_price": {
      const nameValue = textArg(args, "name");
      const unit = normalizeUnit(args.unit) || (isUnit(args.unit) ? args.unit : null);
      const cents = parseDollarsToCents(textArg(args, "price", 20));
      if (!nameValue || !unit || cents == null) {
        return { ok: false, summary: "Need a name, unit, and price.", href: "/library", spotlight: "price-add" };
      }
      const id = await data.createCustomItem(userId, { name: nameValue, unit, unitPriceCents: cents });
      return {
        ok: true,
        summary: `Added ${nameValue}.`,
        href: "/library",
        spotlight: `price-${id}`,
      };
    }
    case "update_price": {
      const id = textArg(args, "id", 80);
      const current = await data.getLibraryItem(userId, id);
      if (!current) return { ok: false, summary: "That price is not in your library.", href: "/library", spotlight: "price-table" };
      const unit = args.unit ? normalizeUnit(args.unit) : current.unit;
      const cents = args.price ? parseDollarsToCents(args.price) : current.unitPriceCents;
      const nameValue = args.name ? textArg(args, "name") : current.name;
      if (!unit || cents == null || !nameValue) {
        return { ok: false, summary: "That edit was not valid.", href: "/library", spotlight: `price-${id}` };
      }
      await data.updateLibraryItem(userId, id, { name: nameValue, unit, unitPriceCents: cents });
      return { ok: true, summary: `Updated ${nameValue}.`, href: "/library", spotlight: `price-${id}` };
    }
    case "create_group": {
      const nameValue = textArg(args, "name", 80);
      if (!nameValue) return { ok: false, summary: "Give the group a name.", href: "/library/groups", spotlight: "group-list" };
      const id = await data.createGroup(userId, nameValue);
      return { ok: true, summary: `Created ${nameValue}.`, href: `/library/groups/${id}`, spotlight: `group-${id}` };
    }
    case "add_price_to_group": {
      const groupId = textArg(args, "groupId", 80);
      const libraryItemId = textArg(args, "libraryItemId", 80);
      const ok = await data.addGroupItem(userId, groupId, libraryItemId);
      return {
        ok,
        summary: ok ? "Added the price to the group." : "Could not add that price.",
        href: `/library/groups/${groupId}`,
        spotlight: `group-${groupId}`,
      };
    }
    case "create_quote": {
      const customerName = textArg(args, "customerName", 80);
      const title = textArg(args, "title", 80);
      if (!customerName || !title) {
        return { ok: false, summary: "Need a customer and a job.", href: "/quotes/new", spotlight: "new-quote" };
      }
      const id = await data.createQuote(userId, { customerName, title });
      return { ok: true, summary: `Started a quote for ${customerName}.`, href: `/quotes/${id}`, spotlight: "quote-options" };
    }
    case "update_quote": {
      const id = textArg(args, "id", 80);
      const current = await data.getQuote(userId, id);
      if (!current) return { ok: false, summary: "That quote is not yours.", href: "/", spotlight: "new-quote" };
      const customerName = args.customerName ? textArg(args, "customerName", 80) : current.customerName;
      const title = args.title ? textArg(args, "title", 80) : current.title;
      await data.updateQuote(userId, id, { customerName, title });
      return { ok: true, summary: "Saved the quote details.", href: `/quotes/${id}`, spotlight: "quote-options" };
    }
    case "use_good_better_best": {
      const quoteId = textArg(args, "quoteId", 80);
      const ok = await data.useGoodBetterBest(userId, quoteId);
      return {
        ok,
        summary: ok ? "Set Good, Better, and Best." : "Could not change the options.",
        href: `/quotes/${quoteId}`,
        spotlight: "quote-options",
      };
    }
    case "toggle_group_on_tier": {
      const tierId = textArg(args, "tierId", 80);
      const groupId = textArg(args, "groupId", 80);
      const ok = await data.toggleTierGroup(userId, tierId, groupId);
      return {
        ok,
        summary: ok ? "Updated the option." : "Could not update that option.",
        href: "/",
        spotlight: tierId ? `tier-${tierId}` : "quote-options",
      };
    }
    case "connect_catalog": {
      const slug = textArg(args, "slug", 40);
      const added = await data.connectConnector(userId, slug);
      return {
        ok: added != null,
        summary: added == null ? "That catalog is not available." : `Added ${added} sample item${added === 1 ? "" : "s"}.`,
        href: "/catalogs",
        spotlight: "catalog-table",
      };
    }
    case "import_prices": {
      const parsed = parsePriceCsv(args.csv || "");
      if (parsed.rows.length === 0) {
        return { ok: false, summary: parsed.errors[0] || "Nothing to import.", href: "/library", spotlight: "price-import" };
      }
      const plain = parsed.rows.filter((row) => !row.sku);
      const added = await data.importLibraryRows(
        userId,
        plain.map((row) => ({ name: row.name, unit: row.unit, unitPriceCents: row.unitPriceCents })),
      );
      let linked = 0;
      const catalog = await data.listCatalog();
      for (const row of parsed.rows) {
        if (!row.sku) continue;
        const hit = catalog.find((item) => item.skuCode?.toLowerCase() === row.sku?.toLowerCase());
        if (!hit) continue;
        const result = await data.addSkuToLibrary(userId, hit.id);
        if (result === "missing") continue;
        const items = await data.listLibrary(userId);
        const owned = items.find((item) => item.skuId === hit.id);
        if (owned) {
          await data.updateLibraryItem(userId, owned.id, {
            name: owned.name,
            unit: owned.unit,
            unitPriceCents: row.unitPriceCents,
          });
          linked += 1;
        }
      }
      return {
        ok: true,
        summary: `Imported ${added + linked} price${added + linked === 1 ? "" : "s"}.`,
        href: "/library",
        spotlight: "price-table",
      };
    }
    case "set_asking_price": {
      const quoteId = textArg(args, "quoteId", 80);
      const amount = parseDollarsToCents(textArg(args, "amount", 20));
      const row = quoteId ? await getGuideQuote(userId, quoteId) : null;
      if (!quoteId || amount == null || !row) {
        return { ok: false, summary: "Open the price and give an amount, like 160.", href: quoteId ? `/guide/${quoteId}` : "/", spotlight: "asking-price" };
      }
      const data = await getData();
      const quote = await data.getQuote(userId, quoteId);
      const groups = await data.listGroups(userId);
      const group = quote?.tiers[0]?.groupIds.map((id) => groups.find((item) => item.id === id)).find(Boolean);
      const items = group?.items ?? [];
      const target = textArg(args, "target", 20) || "total";
      const lineId = textArg(args, "lineId", 80);
      const chosen = target === "line" ? items.find((item) => item.id === lineId) : null;
      if (chosen) {
        const quantity = chosen.quantity || 1;
        await data.updateGroupItem(userId, chosen.id, {
          quantity,
          unitPriceCents: Math.max(0, Math.round(amount / quantity)),
        });
      } else if (items[0]) {
        const others = items.slice(1).reduce((sum, item) => sum + lineTotalCents(item.quantity || 1, item.unitPriceCents), 0);
        const quantity = items[0].quantity || 1;
        const next = Math.max(0, amount - others);
        await data.updateGroupItem(userId, items[0].id, {
          quantity,
          unitPriceCents: Math.max(0, Math.round(next / quantity)),
        });
      }
      const freshGroups = await data.listGroups(userId);
      const fresh = quote?.tiers[0]?.groupIds.map((id) => freshGroups.find((item) => item.id === id)).find(Boolean);
      const lines = (fresh?.items ?? []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      }));
      const priceCents = lines.length ? settledTotal(lines, adjustmentFromSources(row.sources)) : amount;
      const sources = withOverride(row.sources, priceCents);
      await saveGuideQuote({ ...row, sources, priceCents, step: row.step === "describe" ? "review" : row.step });
      const named = chosen?.name;
      return {
        ok: true,
        summary: named
          ? `Done. ${named} is now ${formatUsd(amount)}; quote total ${formatUsd(priceCents)}.`
          : `Done. The total is now ${formatUsd(priceCents)}.`,
        href: `/guide/${quoteId}`,
        spotlight: "asking-price",
      };
    }
    case "mark_sold": {
      const quoteId = textArg(args, "quoteId", 80);
      const row = quoteId ? await getGuideQuote(userId, quoteId) : null;
      if (!quoteId || !row) {
        return { ok: false, summary: "Open the price first.", href: "/", spotlight: "mark-sold" };
      }
      const parsed = args.amount ? parseDollarsToCents(textArg(args, "amount", 20)) : null;
      const soldFor = parsed == null ? row.priceCents : Math.round(parsed / 100) * 100;
      await saveGuideQuote({
        ...row,
        outcome: "sold",
        priceCents: soldFor ?? row.priceCents,
        step: "sold",
        finishedAt: row.finishedAt || new Date().toISOString(),
      });
      const guide = await ensureGuideUser(userId);
      await recordFunnel(userId, "first_mark_sold", { path: row.path, variant: guide.variant });
      return {
        ok: true,
        summary: `Marked sold${soldFor != null ? ` for ${formatUsd(soldFor)}` : ""}.`,
        href: `/guide/${quoteId}`,
        spotlight: "mark-sold",
      };
    }
    case "present_quote": {
      const quoteId = textArg(args, "quoteId", 80);
      const quote = await data.getQuote(userId, quoteId);
      if (!quote || quote.tiers.length === 0) {
        return { ok: false, summary: "Add an option before presenting.", href: quoteId ? `/quotes/${quoteId}` : "/", spotlight: "present-button" };
      }
      const groups = await data.listGroups(userId);
      await data.saveSnapshot(userId, quoteId, buildPresentation(quote, groups));
      return { ok: true, summary: "Saved the customer copy.", href: `/quotes/${quoteId}/present`, spotlight: "present-deck" };
    }
    case "delete_quote": {
      const id = textArg(args, "id", 80);
      const ok = await data.deleteQuote(userId, id);
      return { ok, summary: ok ? "Deleted the quote." : "Could not delete that quote.", href: "/", spotlight: "new-quote" };
    }
    case "delete_price": {
      const id = textArg(args, "id", 80);
      const ok = await data.deleteLibraryItem(userId, id);
      return { ok, summary: ok ? "Deleted the price." : "Could not delete that price.", href: "/library", spotlight: "price-table" };
    }
    case "delete_group": {
      const id = textArg(args, "id", 80);
      const ok = await data.deleteGroup(userId, id);
      return { ok, summary: ok ? "Deleted the group." : "Could not delete that group.", href: "/library/groups", spotlight: "group-list" };
    }
    default:
      return { ok: false, summary: "That action is not available.", href: "/", spotlight: "new-quote" };
  }
}
