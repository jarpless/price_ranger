import { jpegFromDataUrl, buildPricePdf } from "@/lib/guide/pdf";
import { readSharedSheet } from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const sheet = await readSharedSheet(token);
  if (!sheet) return new Response(null, { status: 404 });
  const option = sheet.options[0];
  const pdf = buildPricePdf({
    title: sheet.title,
    subtitle: sheet.subtitle,
    lines: option?.lines ?? [],
    total: option?.total ?? "",
    jpeg: jpegFromDataUrl(sheet.photo),
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="price.pdf"',
      "Cache-Control": "private, max-age=60",
    },
  });
}
