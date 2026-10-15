import { jpegFromDataUrl, buildPricePdf, pdfFilename } from "@/lib/guide/pdf";
import { formatUsd } from "@/lib/money";
import { marketPrice } from "@/lib/market";
import { forPublic, readSharedSheet } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const loaded = await readSharedSheet(token);
  if (!loaded) return new Response(null, { status: 404 });
  const sheet = forPublic(loaded);
  const option = sheet.options[0];
  const date = sheet.date || new Date().toISOString().slice(0, 10);
  const filename = pdfFilename(sheet.title, date);
  const lines = option?.lines.length
    ? option.lines
    : [{ name: sheet.title, detail: sheet.range || "", price: option?.total || "" }];
  const live = marketPrice(sheet.title);
  const comparables = (live?.comparables ?? []).slice(0, 4).map((comp) => ({
    title: comp.title,
    detail: [comp.source, comp.condition, comp.soldAt].filter(Boolean).join(" · "),
    price: formatUsd(comp.priceCents),
  }));
  const pdf = buildPricePdf({
    title: sheet.title,
    subtitle: sheet.subtitle || sheet.note || "",
    condition: sheet.condition,
    range: sheet.range,
    lines,
    total: option?.total || (live ? formatUsd(live.cents) : ""),
    jpeg: jpegFromDataUrl(sheet.photo),
    date,
    comparables,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
