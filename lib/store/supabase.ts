import { connectorBySlug } from "../connectors";
import { filterCatalog } from "../search";
import { toQuoteListItem } from "../project";
import { createClient } from "../supabase/server";
import type {
  CatalogHit,
  ConnectorConnection,
  GroupItem,
  ItemGroup,
  LibraryItem,
  PresentedSnapshot,
  QuoteListItem,
  QuoteRecord,
  QuoteTier,
  Unit,
} from "../types";
import type { DataStore } from "./types";

type QueryResult = { data: unknown; error: { message: string } | null };

async function client(): Promise<LooseClient> {
  // Untyped until the new Supabase project exists and types are generated.
  return (await createClient()) as unknown as LooseClient;
}

interface LooseClient {
  from: (table: string) => Query & {
    insert: (values: unknown) => Query;
    update: (values: unknown) => Query;
    delete: () => Query;
    upsert: (values: unknown, options?: { onConflict?: string }) => Query;
  };
}

type Query = PromiseLike<QueryResult> & {
  select: (columns?: string) => Query;
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: unknown[]) => Query;
  order: (column: string, options?: { ascending?: boolean }) => Query;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
};

async function many(query: Query): Promise<Record<string, unknown>[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Record<string, unknown>[];
}

async function one(query: Query): Promise<Record<string, unknown> | null> {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown> | null) ?? null;
}

function text(row: Record<string, unknown>, key: string): string {
  return String(row[key] ?? "");
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapLibrary(row: Record<string, unknown>): LibraryItem {
  return {
    id: text(row, "id"),
    userId: text(row, "user_id"),
    skuId: (row.sku_id as string | null) ?? null,
    connectorSlug: (row.connector_slug as string | null) ?? null,
    name: text(row, "name"),
    unit: text(row, "unit") as Unit,
    unitPriceCents: num(row.unit_price_cents),
    samplePrice: Boolean(row.sample_price),
    source: text(row, "source") as LibraryItem["source"],
    createdAt: text(row, "created_at"),
  };
}

function mapGroupItem(row: Record<string, unknown>): GroupItem {
  return {
    id: text(row, "id"),
    groupId: text(row, "group_id"),
    libraryItemId: (row.library_item_id as string | null) ?? null,
    name: text(row, "name"),
    unit: text(row, "unit") as Unit,
    unitPriceCents: num(row.unit_price_cents),
    quantity: num(row.quantity),
    sortOrder: num(row.sort_order),
  };
}

function mapGroups(
  groups: Record<string, unknown>[],
  items: Record<string, unknown>[],
): ItemGroup[] {
  return groups
    .map((group) => ({
      id: text(group, "id"),
      userId: text(group, "user_id"),
      name: text(group, "name"),
      summary: text(group, "summary"),
      summaryEdited: Boolean(group.summary_edited),
      createdAt: text(group, "created_at"),
      items: items
        .filter((item) => item.group_id === group.id)
        .map(mapGroupItem)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mapQuote(
  row: Record<string, unknown>,
  tiers: Record<string, unknown>[],
  links: Record<string, unknown>[],
): QuoteRecord {
  const quoteTiers: QuoteTier[] = tiers
    .filter((tier) => tier.quote_id === row.id)
    .map((tier) => ({
      id: text(tier, "id"),
      quoteId: text(tier, "quote_id"),
      name: text(tier, "name"),
      note: text(tier, "note"),
      sortOrder: num(tier.sort_order),
      recommended: Boolean(tier.recommended),
      groupIds: links
        .filter((link) => link.tier_id === tier.id)
        .map((link) => text(link, "group_id")),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: text(row, "id"),
    userId: text(row, "user_id"),
    title: text(row, "title"),
    customerName: text(row, "customer_name"),
    status: text(row, "status") as QuoteRecord["status"],
    createdAt: text(row, "created_at"),
    updatedAt: text(row, "updated_at"),
    presentedSnapshot: (row.presented_snapshot as PresentedSnapshot | null) ?? null,
    tiers: quoteTiers,
  };
}

async function touch(quoteId: string, userId: string) {
  const supabase = await client();
  const { error } = await supabase
    .from("quotes")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", quoteId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

async function ownedQuoteId(userId: string, tierId: string): Promise<string | null> {
  const supabase = await client();
  const tier = await one(supabase.from("quote_tiers").select("id, quote_id").eq("id", tierId));
  if (!tier) return null;
  const quote = await one(
    supabase.from("quotes").select("id").eq("id", tier.quote_id).eq("user_id", userId),
  );
  return quote ? text(tier, "quote_id") : null;
}

export const supabaseStore = {
  async listQuotes(userId: string): Promise<QuoteListItem[]> {
    const supabase = await client();
    const quotes = await many(
      supabase.from("quotes").select("*").eq("user_id", userId).order("updated_at", { ascending: false }),
    );
    const groupRows = await many(
      supabase.from("line_item_groups").select("*").eq("user_id", userId),
    );
    const groups = mapGroups(
      groupRows,
      await groupItemsFor(
        supabase,
        groupRows.map((row) => text(row, "id")),
      ),
    );
    const quoteIds = quotes.map((quote) => text(quote, "id"));
    const tiers = quoteIds.length
      ? await many(supabase.from("quote_tiers").select("*").in("quote_id", quoteIds))
      : [];
    const tierIds = tiers.map((tier) => text(tier, "id"));
    const links = tierIds.length
      ? await many(supabase.from("quote_tier_groups").select("*").in("tier_id", tierIds))
      : [];
    return quotes.map((quote) => toQuoteListItem(mapQuote(quote, tiers, links), groups));
  },

  async getQuote(userId: string, quoteId: string): Promise<QuoteRecord | null> {
    const supabase = await client();
    const quote = await one(
      supabase.from("quotes").select("*").eq("id", quoteId).eq("user_id", userId),
    );
    if (!quote) return null;
    const tiers = await many(supabase.from("quote_tiers").select("*").eq("quote_id", quoteId));
    const tierIds = tiers.map((tier) => text(tier, "id"));
    const links = tierIds.length
      ? await many(supabase.from("quote_tier_groups").select("*").in("tier_id", tierIds))
      : [];
    return mapQuote(quote, tiers, links);
  },

  async createQuote(userId: string, input: { title: string; customerName: string }): Promise<string> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("quotes")
      .insert({
        user_id: userId,
        title: input.title,
        customer_name: input.customerName,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = text(data as Record<string, unknown>, "id");
    const tier = await supabase.from("quote_tiers").insert({
      quote_id: id,
      name: "Standard",
      note: "",
      sort_order: 0,
      recommended: false,
    });
    if (tier.error) throw new Error(tier.error.message);
    return id;
  },

  async updateQuote(
    userId: string,
    quoteId: string,
    input: { title: string; customerName: string },
  ): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("quotes")
      .update({
        title: input.title,
        customer_name: input.customerName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async deleteQuote(userId: string, quoteId: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("quotes")
      .delete()
      .eq("id", quoteId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async saveSnapshot(userId: string, quoteId: string, snapshot: PresentedSnapshot): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("quotes")
      .update({
        presented_snapshot: snapshot,
        status: "presented",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async addTier(userId: string, quoteId: string): Promise<boolean> {
    const quote = await this.getQuote(userId, quoteId);
    if (!quote) return false;
    const supabase = await client();
    const { error } = await supabase.from("quote_tiers").insert({
      quote_id: quoteId,
      name: `Option ${quote.tiers.length + 1}`,
      note: "",
      sort_order: quote.tiers.length,
      recommended: false,
    });
    if (error) throw new Error(error.message);
    await touch(quoteId, userId);
    return true;
  },

  async updateTier(userId: string, tierId: string, input: { name: string; note: string }): Promise<boolean> {
    const quoteId = await ownedQuoteId(userId, tierId);
    if (!quoteId) return false;
    const supabase = await client();
    const { error } = await supabase
      .from("quote_tiers")
      .update({ name: input.name, note: input.note })
      .eq("id", tierId);
    if (error) throw new Error(error.message);
    await touch(quoteId, userId);
    return true;
  },

  async deleteTier(userId: string, tierId: string): Promise<boolean> {
    const quoteId = await ownedQuoteId(userId, tierId);
    if (!quoteId) return false;
    const supabase = await client();
    const { error } = await supabase.from("quote_tiers").delete().eq("id", tierId);
    if (error) throw new Error(error.message);
    await touch(quoteId, userId);
    return true;
  },

  async setRecommended(userId: string, tierId: string, recommended: boolean): Promise<boolean> {
    const quoteId = await ownedQuoteId(userId, tierId);
    if (!quoteId) return false;
    const supabase = await client();
    const clear = await supabase
      .from("quote_tiers")
      .update({ recommended: false })
      .eq("quote_id", quoteId);
    if (clear.error) throw new Error(clear.error.message);
    if (recommended) {
      const set = await supabase.from("quote_tiers").update({ recommended: true }).eq("id", tierId);
      if (set.error) throw new Error(set.error.message);
    }
    await touch(quoteId, userId);
    return true;
  },

  async toggleTierGroup(userId: string, tierId: string, groupId: string): Promise<boolean> {
    const quoteId = await ownedQuoteId(userId, tierId);
    if (!quoteId) return false;
    const supabase = await client();
    const group = await one(
      supabase.from("line_item_groups").select("id").eq("id", groupId).eq("user_id", userId),
    );
    if (!group) return false;
    const existing = await one(
      supabase.from("quote_tier_groups").select("tier_id").eq("tier_id", tierId).eq("group_id", groupId),
    );
    const result = existing
      ? await supabase.from("quote_tier_groups").delete().eq("tier_id", tierId).eq("group_id", groupId)
      : await supabase.from("quote_tier_groups").insert({ tier_id: tierId, group_id: groupId });
    if (result.error) throw new Error(result.error.message);
    await touch(quoteId, userId);
    return true;
  },

  async useGoodBetterBest(userId: string, quoteId: string): Promise<boolean> {
    const quote = await this.getQuote(userId, quoteId);
    if (!quote) return false;
    const supabase = await client();
    const names = ["Good", "Better", "Best"];
    const blankStandard =
      quote.tiers.length === 1 &&
      quote.tiers[0].name === "Standard" &&
      quote.tiers[0].groupIds.length === 0;
    if (blankStandard) {
      const removed = await supabase.from("quote_tiers").delete().eq("id", quote.tiers[0].id);
      if (removed.error) throw new Error(removed.error.message);
      const inserted = await supabase.from("quote_tiers").insert(
        names.map((name, index) => ({
          quote_id: quoteId,
          name,
          note: "",
          sort_order: index,
          recommended: name === "Best",
        })),
      );
      if (inserted.error) throw new Error(inserted.error.message);
    } else {
      const missing = names.filter((name) => !quote.tiers.some((tier) => tier.name === name));
      if (missing.length) {
        const inserted = await supabase.from("quote_tiers").insert(
          missing.map((name, index) => ({
            quote_id: quoteId,
            name,
            note: "",
            sort_order: quote.tiers.length + index,
            recommended: false,
          })),
        );
        if (inserted.error) throw new Error(inserted.error.message);
      }
    }
    await touch(quoteId, userId);
    return true;
  },

  async listLibrary(userId: string): Promise<LibraryItem[]> {
    const supabase = await client();
    const rows = await many(
      supabase.from("library_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    );
    return rows.map(mapLibrary);
  },

  async getLibraryItem(userId: string, itemId: string): Promise<LibraryItem | null> {
    const supabase = await client();
    const row = await one(
      supabase.from("library_items").select("*").eq("id", itemId).eq("user_id", userId),
    );
    return row ? mapLibrary(row) : null;
  },

  async createCustomItem(
    userId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<string> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("library_items")
      .insert({
        user_id: userId,
        name: input.name,
        unit: input.unit,
        unit_price_cents: input.unitPriceCents,
        sample_price: false,
        source: "custom",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return text(data as Record<string, unknown>, "id");
  },

  async addSkuToLibrary(userId: string, skuId: string): Promise<"added" | "exists" | "missing"> {
    const supabase = await client();
    const sku = await one(supabase.from("skus").select("*").eq("id", skuId));
    if (!sku || sku.list_price_cents == null) return "missing";
    const existing = await one(
      supabase.from("library_items").select("id").eq("user_id", userId).eq("sku_id", skuId),
    );
    if (existing) return "exists";
    const { error } = await supabase.from("library_items").insert({
      user_id: userId,
      sku_id: skuId,
      connector_slug: sku.connector_slug,
      name: sku.name,
      unit: sku.unit,
      unit_price_cents: sku.list_price_cents,
      sample_price: true,
      source: "catalog",
    });
    if (error) throw new Error(error.message);
    return "added";
  },

  async updateLibraryItem(
    userId: string,
    itemId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("library_items")
      .update({
        name: input.name,
        unit: input.unit,
        unit_price_cents: input.unitPriceCents,
        sample_price: false,
      })
      .eq("id", itemId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async deleteLibraryItem(userId: string, itemId: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("library_items")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async listGroups(userId: string): Promise<ItemGroup[]> {
    const supabase = await client();
    const groups = await many(supabase.from("line_item_groups").select("*").eq("user_id", userId));
    const items = await groupItemsFor(
      supabase,
      groups.map((group) => text(group, "id")),
    );
    return mapGroups(groups, items);
  },

  async getGroup(userId: string, groupId: string): Promise<ItemGroup | null> {
    const supabase = await client();
    const group = await one(
      supabase.from("line_item_groups").select("*").eq("id", groupId).eq("user_id", userId),
    );
    if (!group) return null;
    const items = await many(supabase.from("group_items").select("*").eq("group_id", groupId));
    return mapGroups([group], items)[0] ?? null;
  },

  async createGroup(userId: string, name: string): Promise<string> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("line_item_groups")
      .insert({ user_id: userId, name, summary: "", summary_edited: false })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return text(data as Record<string, unknown>, "id");
  },

  async updateGroupName(userId: string, groupId: string, name: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("line_item_groups")
      .update({ name })
      .eq("id", groupId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async saveGroupSummary(userId: string, groupId: string, summary: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("line_item_groups")
      .update({ summary, summary_edited: true })
      .eq("id", groupId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async resetGroupSummary(userId: string, groupId: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("line_item_groups")
      .update({ summary: "", summary_edited: false })
      .eq("id", groupId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async addGroupItem(userId: string, groupId: string, libraryItemId: string): Promise<boolean> {
    const group = await this.getGroup(userId, groupId);
    const libraryItem = await this.getLibraryItem(userId, libraryItemId);
    if (!group || !libraryItem) return false;
    if (group.items.some((item) => item.libraryItemId === libraryItemId)) return true;
    const supabase = await client();
    const { error } = await supabase.from("group_items").insert({
      group_id: groupId,
      library_item_id: libraryItemId,
      name: libraryItem.name,
      unit: libraryItem.unit,
      unit_price_cents: libraryItem.unitPriceCents,
      quantity: 1,
      sort_order: group.items.length,
    });
    if (error) throw new Error(error.message);
    return true;
  },

  async updateGroupItem(
    userId: string,
    itemId: string,
    input: { quantity: number; unitPriceCents: number },
  ): Promise<boolean> {
    const supabase = await client();
    const item = await one(supabase.from("group_items").select("*").eq("id", itemId));
    if (!item) return false;
    const group = await one(
      supabase.from("line_item_groups").select("id").eq("id", item.group_id).eq("user_id", userId),
    );
    if (!group) return false;
    const { error } = await supabase
      .from("group_items")
      .update({ quantity: input.quantity, unit_price_cents: input.unitPriceCents })
      .eq("id", itemId);
    if (error) throw new Error(error.message);
    return true;
  },

  async removeGroupItem(userId: string, itemId: string): Promise<boolean> {
    const supabase = await client();
    const item = await one(supabase.from("group_items").select("id, group_id").eq("id", itemId));
    if (!item) return false;
    const group = await one(
      supabase.from("line_item_groups").select("id").eq("id", item.group_id).eq("user_id", userId),
    );
    if (!group) return false;
    const { error } = await supabase.from("group_items").delete().eq("id", itemId);
    if (error) throw new Error(error.message);
    return true;
  },

  async deleteGroup(userId: string, groupId: string): Promise<boolean> {
    const supabase = await client();
    const { data, error } = await supabase
      .from("line_item_groups")
      .delete()
      .eq("id", groupId)
      .eq("user_id", userId)
      .select("id");
    if (error) throw new Error(error.message);
    return ((data as unknown[]) ?? []).length > 0;
  },

  async listConnections(userId: string): Promise<ConnectorConnection[]> {
    const supabase = await client();
    const rows = await many(
      supabase.from("connector_connections").select("*").eq("user_id", userId),
    );
    return rows.map((row) => ({
      slug: text(row, "connector_slug"),
      connectedAt: text(row, "connected_at"),
    }));
  },

  async connectConnector(userId: string, slug: string): Promise<number | null> {
    const connector = connectorBySlug(slug);
    if (!connector || connector.availability === "unavailable") return null;
    const supabase = await client();
    const skus = await many(supabase.from("skus").select("*").eq("connector_slug", slug));
    const existing = await many(
      supabase.from("library_items").select("sku_id").eq("user_id", userId),
    );
    const have = new Set(existing.map((row) => row.sku_id).filter(Boolean));
    const fresh = skus.filter((sku) => sku.list_price_cents != null && !have.has(sku.id));
    if (fresh.length) {
      const inserted = await supabase.from("library_items").insert(
        fresh.map((sku) => ({
          user_id: userId,
          sku_id: sku.id,
          connector_slug: slug,
          name: sku.name,
          unit: sku.unit,
          unit_price_cents: sku.list_price_cents,
          sample_price: true,
          source: "connector",
        })),
      );
      if (inserted.error) throw new Error(inserted.error.message);
    }
    const connection = await supabase.from("connector_connections").upsert(
      { user_id: userId, connector_slug: slug, connected_at: new Date().toISOString() },
      { onConflict: "user_id,connector_slug" },
    );
    if (connection.error) throw new Error(connection.error.message);
    return fresh.length;
  },

  async searchCatalog(query: string): Promise<CatalogHit[]> {
    const supabase = await client();
    const rows = await many(
      supabase
        .from("skus")
        .select("id, sku_code, name, variation, unit, list_price_cents, connector_slug, products(category, brands(name))"),
    );
    const hits: CatalogHit[] = rows.map((row) => {
      const product = firstRelation(row.products) as Record<string, unknown> | null;
      const brand = product ? (firstRelation(product.brands) as Record<string, unknown> | null) : null;
      return {
        id: text(row, "id"),
        name: text(row, "name"),
        variation: (row.variation as string | null) ?? null,
        brandName: brand ? text(brand, "name") : "",
        category: product ? text(product, "category") : "",
        unit: text(row, "unit") as Unit,
        listPriceCents: row.list_price_cents == null ? null : num(row.list_price_cents),
        connectorSlug: text(row, "connector_slug"),
        skuCode: (row.sku_code as string | null) ?? null,
      };
    });
    return filterCatalog(hits, query);
  },
} satisfies DataStore;

async function groupItemsFor(
  supabase: Awaited<ReturnType<typeof client>>,
  groupIds: string[],
): Promise<Record<string, unknown>[]> {
  if (groupIds.length === 0) return [];
  return many(supabase.from("group_items").select("*").in("group_id", groupIds));
}

function firstRelation(value: unknown): unknown {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
