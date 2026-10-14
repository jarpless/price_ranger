import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { EMAIL_CODE_LENGTH } from "../auth-code";
import { BRANDS, PRODUCTS, SKUS, type SkuSeed } from "../catalog";
import { connectorBySlug } from "../connectors";
import { filterCatalog, seededCatalogHits } from "../search";
import type { LibraryImportRow } from "./types";
import { toQuoteListItem } from "../project";
import type { DataStore } from "./types";
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

interface DbUser {
  id: string;
  email: string;
  createdAt: string;
  guest?: boolean;
  industry?: string | null;
  plan?: string | null;
  passExpiresAt?: string | null;
  paidCents?: number;
  passwordHash?: string;
  passwordSalt?: string;
  emailVerified?: boolean;
}

interface MagicLink {
  hash: string;
  email: string;
  expiresAt: number;
}

interface EmailCode {
  hash: string;
  email: string;
  expiresAt: number;
}

interface ShareRow {
  token: string;
  userId: string;
  quoteId: string;
  payload: unknown;
}

interface Db {
  users: DbUser[];
  magicLinks: MagicLink[];
  emailCodes: EmailCode[];
  shares: ShareRow[];
  brands: typeof BRANDS;
  products: typeof PRODUCTS;
  skus: SkuSeed[];
  connections: (ConnectorConnection & { userId: string })[];
  library: LibraryItem[];
  groups: Omit<ItemGroup, "items">[];
  groupItems: GroupItem[];
  quotes: Omit<QuoteRecord, "tiers">[];
  tiers: Omit<QuoteTier, "groupIds">[];
  tierGroups: { tierId: string; groupId: string }[];
}

const dbPath = path.join(process.cwd(), "data", "local-db.json");

let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function emptyDb(): Db {
  return {
    users: [],
    magicLinks: [],
    emailCodes: [],
    shares: [],
    brands: BRANDS,
    products: PRODUCTS,
    skus: SKUS,
    connections: [],
    library: [],
    groups: [],
    groupItems: [],
    quotes: [],
    tiers: [],
    tierGroups: [],
  };
}

async function read(): Promise<Db> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = JSON.parse(raw) as Db;
    db.users ??= [];
    db.magicLinks ??= [];
    db.emailCodes ??= [];
    db.shares ??= [];
    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyDb();
    throw error;
  }
}

async function write(db: Db): Promise<void> {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const temporary = `${dbPath}.tmp`;
  await writeFile(temporary, JSON.stringify(db, null, 2));
  await rename(temporary, dbPath);
}

async function update<T>(fn: (db: Db) => T): Promise<T> {
  return withLock(async () => {
    const db = await read();
    const result = fn(db);
    await write(db);
    return result;
  });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

function assembleGroup(db: Db, group: Omit<ItemGroup, "items">): ItemGroup {
  return {
    ...group,
    items: db.groupItems
      .filter((item) => item.groupId === group.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

function assembleQuote(db: Db, quote: Omit<QuoteRecord, "tiers">): QuoteRecord {
  const tiers = db.tiers
    .filter((tier) => tier.quoteId === quote.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((tier) => ({
      ...tier,
      groupIds: db.tierGroups
        .filter((link) => link.tierId === tier.id)
        .map((link) => link.groupId),
    }));
  return { ...quote, tiers };
}

function userGroups(db: Db, userId: string): ItemGroup[] {
  return db.groups
    .filter((group) => group.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((group) => assembleGroup(db, group));
}

function touch(db: Db, quoteId: string) {
  const quote = db.quotes.find((item) => item.id === quoteId);
  if (quote) quote.updatedAt = nowIso();
}

function requireQuote(db: Db, userId: string, quoteId: string) {
  return db.quotes.find((quote) => quote.id === quoteId && quote.userId === userId) ?? null;
}

function requireGroup(db: Db, userId: string, groupId: string) {
  return db.groups.find((group) => group.id === groupId && group.userId === userId) ?? null;
}

export async function issueMagicLink(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await update((db) => {
    db.magicLinks = db.magicLinks.filter(
      (link) => link.email !== email && link.expiresAt > Date.now(),
    );
    db.magicLinks.push({
      hash: hashToken(token),
      email,
      expiresAt: Date.now() + 1000 * 60 * 15,
    });
  });
  return token;
}

export async function consumeMagicLink(token: string): Promise<DbUser | null> {
  const hash = hashToken(token);
  return update((db) => {
    const index = db.magicLinks.findIndex((link) => link.hash === hash);
    if (index < 0) return null;
    const link = db.magicLinks[index];
    db.magicLinks.splice(index, 1);
    if (link.expiresAt < Date.now()) return null;
    let user = db.users.find((item) => item.email === link.email && !item.guest);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email: link.email,
        createdAt: nowIso(),
        guest: false,
        plan: "free",
        industry: null,
        emailVerified: true,
      };
      db.users.push(user);
    }
    user.emailVerified = true;
    return user;
  });
}

function passwordDigest(password: string, salt: string): string {
  return scryptSync(password, salt, 32).toString("hex");
}

function passwordsMatch(password: string, user: DbUser): boolean {
  if (!user.passwordHash || !user.passwordSalt) return false;
  const actual = Buffer.from(passwordDigest(password, user.passwordSalt), "hex");
  const expected = Buffer.from(user.passwordHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export async function issueEmailCode(email: string): Promise<string> {
  const min = 10 ** (EMAIL_CODE_LENGTH - 1);
  const code = String(min + randomInt(min * 9));
  await update((db) => {
    db.emailCodes = db.emailCodes.filter(
      (item) => item.email !== email && item.expiresAt > Date.now(),
    );
    db.emailCodes.push({
      hash: hashToken(code),
      email,
      expiresAt: Date.now() + 1000 * 60 * 15,
    });
  });
  return code;
}

export async function consumeEmailCode(email: string, code: string): Promise<DbUser | null> {
  const hash = hashToken(code.trim());
  return update((db) => {
    const index = db.emailCodes.findIndex((item) => item.hash === hash && item.email === email);
    if (index < 0) return null;
    const row = db.emailCodes[index];
    db.emailCodes.splice(index, 1);
    if (row.expiresAt < Date.now()) return null;
    let user = db.users.find((item) => item.email === email && !item.guest);
    if (!user) {
      user = {
        id: crypto.randomUUID(),
        email,
        createdAt: nowIso(),
        guest: false,
        plan: "free",
        industry: null,
        emailVerified: true,
      };
      db.users.push(user);
    }
    user.emailVerified = true;
    return user;
  });
}

export async function createGuestUser(): Promise<DbUser> {
  return update((db) => {
    const user: DbUser = {
      id: crypto.randomUUID(),
      email: "",
      createdAt: nowIso(),
      guest: true,
      plan: "free",
      industry: null,
    };
    db.users.push(user);
    return user;
  });
}

export async function setLocalIndustry(userId: string, industry: string): Promise<void> {
  await update((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (user) user.industry = industry;
  });
}

export async function setLocalPlan(
  userId: string,
  plan: string,
  passExpiresAt: string | null,
): Promise<void> {
  await update((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return;
    user.plan = plan;
    user.passExpiresAt = passExpiresAt;
  });
}

export async function addLocalPaidCents(userId: string, cents: number): Promise<void> {
  if (cents <= 0) return;
  await update((db) => {
    const user = db.users.find((item) => item.id === userId);
    if (!user) return;
    user.paidCents = (user.paidCents || 0) + cents;
  });
}

export async function createLocalPasswordAccount(
  email: string,
  password: string,
): Promise<DbUser | "taken" | "password"> {
  if (password.length < 8) return "password";
  return update((db) => {
    if (db.users.some((item) => item.email === email && !item.guest)) return "taken";
    const salt = randomBytes(16).toString("hex");
    const user: DbUser = {
      id: crypto.randomUUID(),
      email,
      createdAt: nowIso(),
      guest: false,
      plan: "free",
      industry: null,
      passwordSalt: salt,
      passwordHash: passwordDigest(password, salt),
      emailVerified: false,
    };
    db.users.push(user);
    return user;
  });
}

export async function verifyLocalPassword(email: string, password: string): Promise<DbUser | "unverified" | null> {
  const db = await read();
  const user = db.users.find((item) => item.email === email && !item.guest);
  if (!user || !passwordsMatch(password, user)) return null;
  if (user.emailVerified === false) return "unverified";
  return user;
}

export async function adoptLocalGuest(guestId: string, userId: string): Promise<void> {
  if (!guestId || guestId === userId) return;
  await update((db) => {
    const guest = db.users.find((item) => item.id === guestId && item.guest);
    const user = db.users.find((item) => item.id === userId);
    if (!guest || !user) return;
    for (const item of db.library) if (item.userId === guestId) item.userId = userId;
    for (const item of db.groups) if (item.userId === guestId) item.userId = userId;
    for (const item of db.quotes) if (item.userId === guestId) item.userId = userId;
    for (const item of db.connections) if (item.userId === guestId) item.userId = userId;
    for (const item of db.shares) if (item.userId === guestId) item.userId = userId;
    if (!user.industry && guest.industry) user.industry = guest.industry;
    db.users = db.users.filter((item) => item.id !== guestId);
  });
}

export async function publishLocalSheet(
  userId: string,
  quoteId: string,
  payload: unknown,
): Promise<string | null> {
  return update((db) => {
    if (!requireQuote(db, userId, quoteId)) return null;
    const existing = db.shares.find((item) => item.userId === userId && item.quoteId === quoteId);
    if (existing) {
      existing.payload = payload;
      return existing.token;
    }
    const token = randomBytes(12).toString("base64url");
    db.shares.push({ token, userId, quoteId, payload });
    return token;
  });
}

export async function readLocalSheet(token: string): Promise<unknown | null> {
  const db = await read();
  return db.shares.find((item) => item.token === token)?.payload ?? null;
}

export async function getLocalUser(userId: string): Promise<DbUser | null> {
  const db = await read();
  return db.users.find((user) => user.id === userId) ?? null;
}

export async function deleteLocalAccount(userId: string): Promise<void> {
  await update((db) => {
    const groupIds = new Set(db.groups.filter((group) => group.userId === userId).map((group) => group.id));
    const quoteIds = new Set(db.quotes.filter((quote) => quote.userId === userId).map((quote) => quote.id));
    const tierIds = new Set(db.tiers.filter((tier) => quoteIds.has(tier.quoteId)).map((tier) => tier.id));
    db.users = db.users.filter((user) => user.id !== userId);
    db.library = db.library.filter((item) => item.userId !== userId);
    db.groups = db.groups.filter((group) => group.userId !== userId);
    db.groupItems = db.groupItems.filter((item) => !groupIds.has(item.groupId));
    db.quotes = db.quotes.filter((quote) => quote.userId !== userId);
    db.tiers = db.tiers.filter((tier) => !quoteIds.has(tier.quoteId));
    db.tierGroups = db.tierGroups.filter((link) => !tierIds.has(link.tierId));
    db.connections = db.connections.filter((item) => item.userId !== userId);
    db.shares = db.shares.filter((item) => item.userId !== userId);
  });
}

export const localStore = {
  async listQuotes(userId: string): Promise<QuoteListItem[]> {
    const db = await read();
    const groups = userGroups(db, userId);
    return db.quotes
      .filter((quote) => quote.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((quote) => toQuoteListItem(assembleQuote(db, quote), groups));
  },

  async getQuote(userId: string, quoteId: string): Promise<QuoteRecord | null> {
    const db = await read();
    const quote = requireQuote(db, userId, quoteId);
    return quote ? assembleQuote(db, quote) : null;
  },

  async createQuote(userId: string, input: { title: string; customerName: string }): Promise<string> {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    await update((db) => {
      db.quotes.push({
        id,
        userId,
        title: input.title,
        customerName: input.customerName,
        status: "draft",
        createdAt: timestamp,
        updatedAt: timestamp,
        presentedSnapshot: null,
      });
      db.tiers.push({
        id: crypto.randomUUID(),
        quoteId: id,
        name: "Standard",
        note: "",
        sortOrder: 0,
        recommended: false,
      });
    });
    return id;
  },

  async updateQuote(
    userId: string,
    quoteId: string,
    input: { title: string; customerName: string },
  ): Promise<boolean> {
    return update((db) => {
      const quote = requireQuote(db, userId, quoteId);
      if (!quote) return false;
      quote.title = input.title;
      quote.customerName = input.customerName;
      quote.updatedAt = nowIso();
      return true;
    });
  },

  async deleteQuote(userId: string, quoteId: string): Promise<boolean> {
    return update((db) => {
      const quote = requireQuote(db, userId, quoteId);
      if (!quote) return false;
      const tierIds = new Set(db.tiers.filter((tier) => tier.quoteId === quoteId).map((tier) => tier.id));
      db.quotes = db.quotes.filter((item) => item.id !== quoteId);
      db.tiers = db.tiers.filter((tier) => tier.quoteId !== quoteId);
      db.tierGroups = db.tierGroups.filter((link) => !tierIds.has(link.tierId));
      return true;
    });
  },

  async saveSnapshot(
    userId: string,
    quoteId: string,
    snapshot: PresentedSnapshot,
  ): Promise<boolean> {
    return update((db) => {
      const quote = requireQuote(db, userId, quoteId);
      if (!quote) return false;
      quote.presentedSnapshot = snapshot;
      quote.status = "presented";
      quote.updatedAt = nowIso();
      return true;
    });
  },

  async addTier(userId: string, quoteId: string): Promise<boolean> {
    return update((db) => {
      if (!requireQuote(db, userId, quoteId)) return false;
      const sortOrder = db.tiers.filter((tier) => tier.quoteId === quoteId).length;
      db.tiers.push({
        id: crypto.randomUUID(),
        quoteId,
        name: `Option ${sortOrder + 1}`,
        note: "",
        sortOrder,
        recommended: false,
      });
      touch(db, quoteId);
      return true;
    });
  },

  async updateTier(
    userId: string,
    tierId: string,
    input: { name: string; note: string },
  ): Promise<boolean> {
    return update((db) => {
      const tier = db.tiers.find((item) => item.id === tierId);
      if (!tier || !requireQuote(db, userId, tier.quoteId)) return false;
      tier.name = input.name;
      tier.note = input.note;
      touch(db, tier.quoteId);
      return true;
    });
  },

  async deleteTier(userId: string, tierId: string): Promise<boolean> {
    return update((db) => {
      const tier = db.tiers.find((item) => item.id === tierId);
      if (!tier || !requireQuote(db, userId, tier.quoteId)) return false;
      db.tiers = db.tiers.filter((item) => item.id !== tierId);
      db.tierGroups = db.tierGroups.filter((link) => link.tierId !== tierId);
      touch(db, tier.quoteId);
      return true;
    });
  },

  async setRecommended(userId: string, tierId: string, recommended: boolean): Promise<boolean> {
    return update((db) => {
      const tier = db.tiers.find((item) => item.id === tierId);
      if (!tier || !requireQuote(db, userId, tier.quoteId)) return false;
      for (const item of db.tiers) {
        if (item.quoteId === tier.quoteId) {
          item.recommended = recommended && item.id === tierId;
        }
      }
      touch(db, tier.quoteId);
      return true;
    });
  },

  async toggleTierGroup(userId: string, tierId: string, groupId: string): Promise<boolean> {
    return update((db) => {
      const tier = db.tiers.find((item) => item.id === tierId);
      if (!tier || !requireQuote(db, userId, tier.quoteId)) return false;
      if (!requireGroup(db, userId, groupId)) return false;
      const index = db.tierGroups.findIndex(
        (link) => link.tierId === tierId && link.groupId === groupId,
      );
      if (index >= 0) db.tierGroups.splice(index, 1);
      else db.tierGroups.push({ tierId, groupId });
      touch(db, tier.quoteId);
      return true;
    });
  },

  async useGoodBetterBest(userId: string, quoteId: string): Promise<boolean> {
    return update((db) => {
      if (!requireQuote(db, userId, quoteId)) return false;
      const names = ["Good", "Better", "Best"];
      const tiers = db.tiers.filter((tier) => tier.quoteId === quoteId);
      const blankStandard =
        tiers.length === 1 &&
        tiers[0].name === "Standard" &&
        !db.tierGroups.some((link) => link.tierId === tiers[0].id);
      if (blankStandard) {
        db.tiers = db.tiers.filter((tier) => tier.id !== tiers[0].id);
        names.forEach((name, index) => {
          db.tiers.push({
            id: crypto.randomUUID(),
            quoteId,
            name,
            note: "",
            sortOrder: index,
            recommended: name === "Best",
          });
        });
      } else {
        for (const name of names) {
          if (tiers.some((tier) => tier.name === name)) continue;
          db.tiers.push({
            id: crypto.randomUUID(),
            quoteId,
            name,
            note: "",
            sortOrder: db.tiers.filter((tier) => tier.quoteId === quoteId).length,
            recommended: false,
          });
        }
      }
      touch(db, quoteId);
      return true;
    });
  },

  async listLibrary(userId: string): Promise<LibraryItem[]> {
    const db = await read();
    return db.library
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getLibraryItem(userId: string, itemId: string): Promise<LibraryItem | null> {
    const db = await read();
    return db.library.find((item) => item.id === itemId && item.userId === userId) ?? null;
  },

  async createCustomItem(
    userId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<string> {
    const id = crypto.randomUUID();
    await update((db) => {
      db.library.push({
        id,
        userId,
        skuId: null,
        connectorSlug: null,
        name: input.name,
        unit: input.unit,
        unitPriceCents: input.unitPriceCents,
        samplePrice: false,
        source: "custom",
        createdAt: nowIso(),
      });
    });
    return id;
  },

  async addSkuToLibrary(userId: string, skuId: string): Promise<"added" | "exists" | "missing"> {
    return update((db) => {
      const sku = db.skus.find((item) => item.id === skuId);
      if (!sku || sku.listPriceCents == null) return "missing";
      if (db.library.some((item) => item.userId === userId && item.skuId === skuId)) {
        return "exists";
      }
      db.library.push({
        id: crypto.randomUUID(),
        userId,
        skuId: sku.id,
        connectorSlug: sku.connectorSlug,
        name: sku.name,
        unit: sku.unit,
        unitPriceCents: sku.listPriceCents,
        samplePrice: true,
        source: "catalog",
        createdAt: nowIso(),
      });
      return "added";
    });
  },

  async updateLibraryItem(
    userId: string,
    itemId: string,
    input: { name: string; unit: Unit; unitPriceCents: number },
  ): Promise<boolean> {
    return update((db) => {
      const item = db.library.find((entry) => entry.id === itemId && entry.userId === userId);
      if (!item) return false;
      item.name = input.name;
      item.unit = input.unit;
      item.unitPriceCents = input.unitPriceCents;
      item.samplePrice = false;
      return true;
    });
  },

  async deleteLibraryItem(userId: string, itemId: string): Promise<boolean> {
    return update((db) => {
      const item = db.library.find((entry) => entry.id === itemId && entry.userId === userId);
      if (!item) return false;
      db.library = db.library.filter((entry) => entry.id !== itemId);
      for (const line of db.groupItems) {
        if (line.libraryItemId === itemId) line.libraryItemId = null;
      }
      return true;
    });
  },

  async listGroups(userId: string): Promise<ItemGroup[]> {
    const db = await read();
    return userGroups(db, userId);
  },

  async getGroup(userId: string, groupId: string): Promise<ItemGroup | null> {
    const db = await read();
    const group = requireGroup(db, userId, groupId);
    return group ? assembleGroup(db, group) : null;
  },

  async createGroup(userId: string, name: string): Promise<string> {
    const id = crypto.randomUUID();
    await update((db) => {
      db.groups.push({
        id,
        userId,
        name,
        summary: "",
        summaryEdited: false,
        createdAt: nowIso(),
      });
    });
    return id;
  },

  async updateGroupName(userId: string, groupId: string, name: string): Promise<boolean> {
    return update((db) => {
      const group = requireGroup(db, userId, groupId);
      if (!group) return false;
      group.name = name;
      return true;
    });
  },

  async saveGroupSummary(userId: string, groupId: string, summary: string): Promise<boolean> {
    return update((db) => {
      const group = requireGroup(db, userId, groupId);
      if (!group) return false;
      group.summary = summary;
      group.summaryEdited = true;
      return true;
    });
  },

  async resetGroupSummary(userId: string, groupId: string): Promise<boolean> {
    return update((db) => {
      const group = requireGroup(db, userId, groupId);
      if (!group) return false;
      group.summary = "";
      group.summaryEdited = false;
      return true;
    });
  },

  async addGroupItem(userId: string, groupId: string, libraryItemId: string): Promise<boolean> {
    return update((db) => {
      if (!requireGroup(db, userId, groupId)) return false;
      const libraryItem = db.library.find(
        (item) => item.id === libraryItemId && item.userId === userId,
      );
      if (!libraryItem) return false;
      if (db.groupItems.some((item) => item.groupId === groupId && item.libraryItemId === libraryItemId)) {
        return true;
      }
      const sortOrder = db.groupItems.filter((item) => item.groupId === groupId).length;
      db.groupItems.push({
        id: crypto.randomUUID(),
        groupId,
        libraryItemId,
        name: libraryItem.name,
        unit: libraryItem.unit,
        unitPriceCents: libraryItem.unitPriceCents,
        quantity: 1,
        sortOrder,
      });
      return true;
    });
  },

  async updateGroupItem(
    userId: string,
    itemId: string,
    input: { quantity: number; unitPriceCents: number },
  ): Promise<boolean> {
    return update((db) => {
      const item = db.groupItems.find((entry) => entry.id === itemId);
      if (!item || !requireGroup(db, userId, item.groupId)) return false;
      item.quantity = input.quantity;
      item.unitPriceCents = input.unitPriceCents;
      return true;
    });
  },

  async removeGroupItem(userId: string, itemId: string): Promise<boolean> {
    return update((db) => {
      const item = db.groupItems.find((entry) => entry.id === itemId);
      if (!item || !requireGroup(db, userId, item.groupId)) return false;
      db.groupItems = db.groupItems.filter((entry) => entry.id !== itemId);
      return true;
    });
  },

  async deleteGroup(userId: string, groupId: string): Promise<boolean> {
    return update((db) => {
      if (!requireGroup(db, userId, groupId)) return false;
      db.groups = db.groups.filter((group) => group.id !== groupId);
      db.groupItems = db.groupItems.filter((item) => item.groupId !== groupId);
      db.tierGroups = db.tierGroups.filter((link) => link.groupId !== groupId);
      return true;
    });
  },

  async listConnections(userId: string): Promise<ConnectorConnection[]> {
    const db = await read();
    return db.connections
      .filter((connection) => connection.userId === userId)
      .map(({ slug, connectedAt }) => ({ slug, connectedAt }));
  },

  async connectConnector(userId: string, slug: string): Promise<number | null> {
    const connector = connectorBySlug(slug);
    if (!connector || connector.availability === "unavailable") return null;
    return update((db) => {
      const existing = new Set(
        db.library.filter((item) => item.userId === userId && item.skuId).map((item) => item.skuId),
      );
      let added = 0;
      for (const sku of db.skus.filter((item) => item.connectorSlug === slug)) {
        if (existing.has(sku.id) || sku.listPriceCents == null) continue;
        db.library.push({
          id: crypto.randomUUID(),
          userId,
          skuId: sku.id,
          connectorSlug: slug,
          name: sku.name,
          unit: sku.unit,
          unitPriceCents: sku.listPriceCents,
          samplePrice: true,
          source: "connector",
          createdAt: nowIso(),
        });
        added += 1;
      }
      if (!db.connections.some((item) => item.userId === userId && item.slug === slug)) {
        db.connections.push({ userId, slug, connectedAt: nowIso() });
      }
      return added;
    });
  },

  async listCatalog(): Promise<CatalogHit[]> {
    return seededCatalogHits();
  },

  async searchCatalog(query: string): Promise<CatalogHit[]> {
    return filterCatalog(seededCatalogHits(), query);
  },

  async importLibraryRows(userId: string, rows: LibraryImportRow[]): Promise<number> {
    return update((db) => {
      for (const row of rows) {
        db.library.push({
          id: crypto.randomUUID(),
          userId,
          skuId: null,
          connectorSlug: null,
          name: row.name,
          unit: row.unit,
          unitPriceCents: row.unitPriceCents,
          samplePrice: false,
          source: "custom",
          createdAt: nowIso(),
        });
      }
      return rows.length;
    });
  },
} satisfies DataStore;
