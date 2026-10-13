const ROOTS = new Set(["/", "/menu", "/welcome"]);

export function isRootPath(pathname: string): boolean {
  return ROOTS.has(pathname);
}

/** A real route, so Back paints the screen it names instead of replaying history. */
export function backTarget(pathname: string): string {
  if (pathname.startsWith("/guide/")) return "/";
  if (pathname.startsWith("/quotes/") && pathname.endsWith("/sheet")) return pathname.replace(/\/sheet$/, "");
  if (pathname.startsWith("/quotes/")) return "/quotes";
  if (pathname.startsWith("/library/groups/")) return "/library/groups";
  if (pathname.startsWith("/library/")) return "/library";
  if (pathname.startsWith("/feedback/")) return "/menu";
  if (pathname.startsWith("/settings")) return "/menu";
  if (pathname.startsWith("/tours/")) return "/";
  if (pathname.startsWith("/admin/")) return "/menu";
  return "/";
}
