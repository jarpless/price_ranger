/**
 * The quote builder is on unless QUOTE_BUILDER=0.
 * Sheet and media JSON live in the existing guide sources array, so the
 * feature does not need a new database column.
 * QUOTE_BUILDER_SCHEMA=1 is reserved for a later cutover to the columns in
 * supabase/migrations/20261017120000_quote_builder.sql. That file is not applied
 * by the app, and this process never writes those columns.
 */
export function quoteBuilderEnabled(): boolean {
  return process.env.QUOTE_BUILDER !== "0";
}

export function quoteBuilderSchemaEnabled(): boolean {
  return process.env.QUOTE_BUILDER_SCHEMA === "1";
}
