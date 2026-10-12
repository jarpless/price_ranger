export const UNITS = [
  "square",
  "sq_ft",
  "linear_ft",
  "roll",
  "bundle",
  "each",
  "hour",
] as const;

export type Unit = (typeof UNITS)[number];

export type ItemSource = "custom" | "connector" | "catalog";

export type QuoteStatus = "draft" | "presented";

export interface SessionUser {
  id: string;
  email: string;
}

export interface LibraryItem {
  id: string;
  userId: string;
  skuId: string | null;
  connectorSlug: string | null;
  name: string;
  unit: Unit;
  unitPriceCents: number;
  samplePrice: boolean;
  source: ItemSource;
  createdAt: string;
}

export interface GroupItem {
  id: string;
  groupId: string;
  libraryItemId: string | null;
  name: string;
  unit: Unit;
  unitPriceCents: number;
  quantity: number;
  sortOrder: number;
}

export interface ItemGroup {
  id: string;
  userId: string;
  name: string;
  summary: string;
  summaryEdited: boolean;
  createdAt: string;
  items: GroupItem[];
}

export interface QuoteTier {
  id: string;
  quoteId: string;
  name: string;
  note: string;
  sortOrder: number;
  recommended: boolean;
  groupIds: string[];
}

export interface QuoteRecord {
  id: string;
  userId: string;
  title: string;
  customerName: string;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
  presentedSnapshot: PresentedSnapshot | null;
  tiers: QuoteTier[];
}

export interface PresentedGroup {
  id: string;
  name: string;
  summary: string;
  totalCents: number;
}

export interface PresentedTier {
  id: string;
  name: string;
  note: string;
  recommended: boolean;
  totalCents: number;
  groups: PresentedGroup[];
}

export interface PresentedSnapshot {
  presentedAt: string;
  customerName: string;
  title: string;
  tiers: PresentedTier[];
}

export interface CatalogHit {
  id: string;
  name: string;
  variation: string | null;
  brandName: string;
  category: string;
  unit: Unit;
  listPriceCents: number | null;
  connectorSlug: string;
  skuCode: string | null;
}

export interface QuoteListItem {
  id: string;
  title: string;
  customerName: string;
  status: QuoteStatus;
  updatedAt: string;
  tierCount: number;
  totals: number[];
  presentedTotals: number[] | null;
}

export interface ConnectorConnection {
  slug: string;
  connectedAt: string;
}
