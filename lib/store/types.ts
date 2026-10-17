import type {
  CatalogHit,
  ConnectorConnection,
  ItemGroup,
  LibraryItem,
  PresentedSnapshot,
  QuoteListItem,
  QuoteRecord,
  Unit,
} from "../types";

export interface LibraryImportRow {
  name: string;
  unit: Unit;
  unitPriceCents: number;
}

export interface DataStore {
  listQuotes(userId: string): Promise<QuoteListItem[]>;
  getQuote(userId: string, quoteId: string): Promise<QuoteRecord | null>;
  createQuote(userId: string, input: { title: string; customerName: string }): Promise<string>;
  updateQuote(
    userId: string,
    quoteId: string,
    input: { title: string; customerName: string },
  ): Promise<boolean>;
  deleteQuote(userId: string, quoteId: string): Promise<boolean>;
  saveSnapshot(userId: string, quoteId: string, snapshot: PresentedSnapshot): Promise<boolean>;
  addTier(userId: string, quoteId: string): Promise<boolean>;
  updateTier(userId: string, tierId: string, input: { name: string; note: string }): Promise<boolean>;
  deleteTier(userId: string, tierId: string): Promise<boolean>;
  setRecommended(userId: string, tierId: string, recommended: boolean): Promise<boolean>;
  toggleTierGroup(userId: string, tierId: string, groupId: string): Promise<boolean>;
  useGoodBetterBest(userId: string, quoteId: string): Promise<boolean>;
  listLibrary(userId: string): Promise<LibraryItem[]>;
  getLibraryItem(userId: string, itemId: string): Promise<LibraryItem | null>;
  createCustomItem(
    userId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<string>;
  addSkuToLibrary(userId: string, skuId: string): Promise<"added" | "exists" | "missing">;
  updateLibraryItem(
    userId: string,
    itemId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<boolean>;
  deleteLibraryItem(userId: string, itemId: string): Promise<boolean>;
  listGroups(userId: string): Promise<ItemGroup[]>;
  getGroup(userId: string, groupId: string): Promise<ItemGroup | null>;
  createGroup(userId: string, name: string): Promise<string>;
  updateGroupName(userId: string, groupId: string, name: string): Promise<boolean>;
  saveGroupSummary(userId: string, groupId: string, summary: string): Promise<boolean>;
  resetGroupSummary(userId: string, groupId: string): Promise<boolean>;
  addGroupItem(userId: string, groupId: string, libraryItemId: string): Promise<boolean>;
  replaceGroupLines(
    userId: string,
    groupId: string,
    lines: { name: string; quantity: number; unitPriceCents: number }[],
  ): Promise<boolean>;
  updateGroupItem(
    userId: string,
    itemId: string,
    input: { quantity: number; unitPriceCents: number },
  ): Promise<boolean>;
  removeGroupItem(userId: string, itemId: string): Promise<boolean>;
  deleteGroup(userId: string, groupId: string): Promise<boolean>;
  listConnections(userId: string): Promise<ConnectorConnection[]>;
  connectConnector(userId: string, slug: string): Promise<number | null>;
  listCatalog(): Promise<CatalogHit[]>;
  searchCatalog(query: string): Promise<CatalogHit[]>;
  importLibraryRows(userId: string, rows: LibraryImportRow[]): Promise<number>;
}
