import { backTarget } from "./nav";

export interface SearchReturn {
  description: string;
  category: string | null;
}

/** The new-price screen, with the words and category the person typed. */
export function searchReturnHref(input: SearchReturn): string {
  const params = new URLSearchParams();
  const description = input.description.slice(0, 280);
  if (description) params.set("q", description);
  if (input.category) params.set("cat", input.category.slice(0, 40));
  const query = params.toString();
  return query ? `/new?${query}` : "/new";
}

/** Quote URL that remembers the search it came from. Opening a saved price has neither. */
export function guideDraftHref(quoteId: string, description: string, category: string | null): string {
  const params = new URLSearchParams();
  const text = description.slice(0, 280);
  if (text) params.set("q", text);
  if (category) params.set("cat", category.slice(0, 40));
  const query = params.toString();
  return query ? `/guide/${quoteId}?${query}` : `/guide/${quoteId}`;
}

/**
 * In-app Back. A quote opened from search returns to that search.
 * A quote opened from the list returns home.
 */
export function backHref(pathname: string, search: string, desktop = false): string {
  if (pathname.startsWith("/guide/")) {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const description = (params.get("q") || "").slice(0, 280);
    const category = params.get("cat");
    if (description || category) return searchReturnHref({ description, category: category ? category.slice(0, 40) : null });
  }
  return backTarget(pathname, desktop);
}
