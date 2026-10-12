import { formatUsd } from "../money";
import { groupCents } from "../project";
import { redactText, type Redaction } from "../redact";
import { customerSummary } from "../summary";
import { getData } from "../store";
import type { ItemGroup, LibraryItem, QuoteListItem } from "../types";

export interface AccountSlice {
  names: string[];
  quotes: QuoteListItem[];
  library: LibraryItem[];
  groups: ItemGroup[];
  catalogs: string[];
}

export async function loadAccount(userId: string, email: string): Promise<AccountSlice> {
  const data = await getData();
  const [quotes, library, groups, connections] = await Promise.all([
    data.listQuotes(userId),
    data.listLibrary(userId),
    data.listGroups(userId),
    data.listConnections(userId),
  ]);
  const names = [email, ...quotes.map((quote) => quote.customerName), ...quotes.map((quote) => quote.title)];
  return {
    names,
    quotes: quotes.slice(0, 20),
    library: library.slice(0, 40),
    groups: groups.slice(0, 20),
    catalogs: connections.map((connection) => connection.slug),
  };
}

export function redactedContext(slice: AccountSlice, pathname: string): { json: string; redaction: Redaction } {
  const draft = {
    screen: pathname,
    quotes: slice.quotes.map((quote) => ({
      id: quote.id,
      path: `/quotes/${quote.id}`,
      customer: quote.customerName,
      job: quote.title,
      status: quote.status,
      totals: quote.totals.map((cents) => formatUsd(cents)),
    })),
    prices: slice.library.map((item) => ({
      id: item.id,
      path: `/library/${item.id}`,
      name: item.name,
      unit: item.unit,
      price: formatUsd(item.unitPriceCents),
    })),
    groups: slice.groups.map((group) => ({
      id: group.id,
      path: `/library/groups/${group.id}`,
      name: group.name,
      total: formatUsd(groupCents(group)),
      summary: customerSummary(group),
    })),
    catalogsConnected: slice.catalogs,
  };
  const redaction = redactText(JSON.stringify(draft), slice.names);
  return { json: redaction.text, redaction };
}

export function localAskAnswer(slice: AccountSlice): string {
  const quoteLinks = slice.quotes
    .slice(0, 5)
    .map((quote) => `- [${quote.customerName}](/quotes/${quote.id}) · ${quote.title}`)
    .join("\n");
  const priceLinks = slice.library
    .slice(0, 5)
    .map((item) => `- [${item.name}](/library/${item.id})`)
    .join("\n");
  const groupLinks = slice.groups
    .slice(0, 5)
    .map((group) => `- [${group.name}](/library/groups/${group.id})`)
    .join("\n");
  return [
    "The assistant model is not configured, so this answer stays on this machine and only uses your account.",
    "",
    `You have ${slice.quotes.length} quote${slice.quotes.length === 1 ? "" : "s"}, ${slice.library.length} price${slice.library.length === 1 ? "" : "s"}, and ${slice.groups.length} group${slice.groups.length === 1 ? "" : "s"}.`,
    quoteLinks ? `\nQuotes\n${quoteLinks}` : "",
    priceLinks ? `\nPrices\n${priceLinks}` : "",
    groupLinks ? `\nGroups\n${groupLinks}` : "",
    "",
    "Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the server for questions that need a model. Names, emails, phones, and addresses are removed before anything is sent.",
  ]
    .filter(Boolean)
    .join("\n");
}
