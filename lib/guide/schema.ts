/**
 * PostgREST and Postgres both say this when a migration has not been applied.
 * PGRST205 is a missing table in the schema cache. PGRST204 is a missing column.
 * 42P01 and 42703 are the same facts from Postgres itself.
 */
export function isMissingSchema(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: unknown; code?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  if (code === "PGRST204" || code === "PGRST205" || code === "42P01" || code === "42703") return true;
  const message = typeof record.message === "string" ? record.message : "";
  return /schema cache|does not exist|undefined_table|undefined_column/i.test(message);
}
