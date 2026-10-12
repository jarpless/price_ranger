import { sumCents } from "./money";
import { customerSummary } from "./summary";
import type {
  ItemGroup,
  PresentedSnapshot,
  QuoteListItem,
  QuoteRecord,
} from "./types";

export function groupCents(group: {
  items: { quantity: number; unitPriceCents: number }[];
}): number {
  return sumCents(group.items);
}

export function liveTierTotals(quote: QuoteRecord, groups: ItemGroup[]): number[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  return [...quote.tiers]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((tier) =>
      tier.groupIds.reduce((sum, id) => {
        const group = byId.get(id);
        return sum + (group ? groupCents(group) : 0);
      }, 0),
    );
}

export function toQuoteListItem(
  quote: QuoteRecord,
  groups: ItemGroup[],
): QuoteListItem {
  return {
    id: quote.id,
    title: quote.title,
    customerName: quote.customerName,
    status: quote.status,
    updatedAt: quote.updatedAt,
    tierCount: quote.tiers.length,
    totals: liveTierTotals(quote, groups),
    presentedTotals: quote.presentedSnapshot
      ? quote.presentedSnapshot.tiers.map((tier) => tier.totalCents)
      : null,
  };
}

export function buildPresentation(
  quote: QuoteRecord,
  groups: ItemGroup[],
): PresentedSnapshot {
  const byId = new Map(groups.map((group) => [group.id, group]));
  return {
    presentedAt: new Date().toISOString(),
    customerName: quote.customerName,
    title: quote.title,
    tiers: [...quote.tiers]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((tier) => {
        const tierGroups = tier.groupIds
          .map((id) => byId.get(id))
          .filter((group): group is ItemGroup => Boolean(group))
          .map((group) => ({
            id: group.id,
            name: group.name,
            summary: customerSummary(group),
            totalCents: groupCents(group),
          }));
        return {
          id: tier.id,
          name: tier.name,
          note: tier.note,
          recommended: tier.recommended,
          totalCents: tierGroups.reduce((sum, group) => sum + group.totalCents, 0),
          groups: tierGroups,
        };
      }),
  };
}

export function presentationDrifted(quote: QuoteRecord, groups: ItemGroup[]): boolean {
  if (!quote.presentedSnapshot) return false;
  const live = liveTierTotals(quote, groups);
  const frozen = quote.presentedSnapshot.tiers.map((tier) => tier.totalCents);
  if (live.length !== frozen.length) return true;
  return live.some((total, index) => total !== frozen[index]);
}
