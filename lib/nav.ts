const ROOTS = new Set(["/", "/welcome"]);

export function isRootPath(pathname: string): boolean {
  return ROOTS.has(pathname);
}

/** A real route, so Back paints the screen it names instead of replaying history. */
export function backTarget(pathname: string, _desktop = false): string {
  void _desktop;
  const hub = "/";
  if (pathname.startsWith("/guide/")) return "/";
  if (pathname.startsWith("/quotes/") && pathname.endsWith("/sheet")) return pathname.replace(/\/sheet$/, "");
  if (pathname.startsWith("/quotes/")) return "/quotes";
  if (pathname.startsWith("/library/groups/")) return "/library/groups";
  if (pathname.startsWith("/library/")) return "/library";
  if (pathname.startsWith("/feedback/")) return hub;
  if (pathname.startsWith("/settings")) return hub;
  if (pathname.startsWith("/upgrade")) return hub;
  if (pathname.startsWith("/install")) return hub;
  if (pathname.startsWith("/tours/")) return "/";
  if (pathname.startsWith("/admin/")) return hub;
  if (pathname.startsWith("/menu")) return hub;
  return "/";
}
