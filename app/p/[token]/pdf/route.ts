import { jpegFromDataUrl, buildPricePdf } from "@/lib/guide/pdf";
import { forPublic, readSharedSheet } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const loaded = await readSharedSheet(token);
  if (!loaded) return new Response(null, { status: 404 });
  const sheet = forPublic(loaded);
  const option = sheet.options[0];
  const date = sheet.date || new Date().toISOString().slice(0, 10);
  const slug = sheet.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
  const filename = `price-ranger-${slug}-${date}.pdf`;
  const lines = option?.lines?.length
    ? option.lines
    : [{ name: sheet.title, detail: "", price: option?.total ?? "" }];
  const pdf = buildPricePdf({
    title: sheet.title,
    subtitle: sheet.subtitle,
    lines,
    total: option?.total ?? "",
    jpeg: jpegFromDataUrl(sheet.photo),
    date,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
