export interface PdfLine {
  name: string;
  detail: string;
  price: string;
}

export interface PdfInput {
  title: string;
  subtitle: string;
  lines: PdfLine[];
  total: string;
  jpeg?: Uint8Array | null;
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let index = 2;
  while (index < bytes.length - 8) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = bytes[index + 1];
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = (bytes[index + 5] << 8) | bytes[index + 6];
      const width = (bytes[index + 7] << 8) | bytes[index + 8];
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (length < 2) return null;
    index += 2 + length;
  }
  return null;
}

function dataUrlToJpeg(value: string | null | undefined): Uint8Array | null {
  if (!value || !value.startsWith("data:image/jpeg")) return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;
  const bytes = Uint8Array.from(Buffer.from(value.slice(comma + 1), "base64"));
  return jpegSize(bytes) ? bytes : null;
}

export function jpegFromDataUrl(value: string | null | undefined): Uint8Array | null {
  return dataUrlToJpeg(value);
}

/** A real one-page PDF. A JPEG is embedded when the photo is a JPEG. */
export function buildPricePdf(input: PdfInput): Uint8Array {
  const jpeg = input.jpeg && jpegSize(input.jpeg) ? input.jpeg : null;
  const size = jpeg ? jpegSize(jpeg) : null;
  const commands: string[] = [];
  let y = 740;
  commands.push(`BT /F1 20 Tf 48 ${y} Td (${escapePdf(input.title.slice(0, 90))}) Tj ET`);
  y -= 22;
  if (input.subtitle) {
    commands.push(`BT /F1 12 Tf 48 ${y} Td (${escapePdf(input.subtitle.slice(0, 90))}) Tj ET`);
    y -= 28;
  }
  for (const line of input.lines.slice(0, 18)) {
    commands.push(`BT /F1 12 Tf 48 ${y} Td (${escapePdf(line.name.slice(0, 48))}) Tj ET`);
    commands.push(`BT /F1 12 Tf 400 ${y} Td (${escapePdf(line.price.slice(0, 24))}) Tj ET`);
    y -= 16;
    commands.push(`BT /F1 10 Tf 48 ${y} Td (${escapePdf(line.detail.slice(0, 80))}) Tj ET`);
    y -= 20;
  }
  y -= 8;
  commands.push(`BT /F1 16 Tf 48 ${y} Td (${escapePdf(`Total ${input.total}`)}) Tj ET`);
  if (size) {
    const maxW = 240;
    const maxH = 180;
    const scale = Math.min(maxW / size.width, maxH / size.height, 1);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    commands.push(`q ${width} 0 0 ${height} 48 80 cm /Im1 Do Q`);
  }
  const stream = commands.join("\n");

  const objects: (string | Uint8Array)[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  const imageRef = jpeg ? " /XObject << /Im1 6 0 R >>" : "";
  objects.push(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >>${imageRef} >> >> endobj\n`,
  );
  objects.push(`4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj\n`);
  objects.push("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n");
  if (jpeg && size) {
    const header = new TextEncoder().encode(
      `6 0 obj << /Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >> stream\n`,
    );
    const footer = new TextEncoder().encode("\nendstream endobj\n");
    const combined = new Uint8Array(header.length + jpeg.length + footer.length);
    combined.set(header, 0);
    combined.set(jpeg, header.length);
    combined.set(footer, header.length + jpeg.length);
    objects.push(combined);
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  let cursor = chunks[0].length;
  const offsets = [0];
  for (const object of objects) {
    const bytes = typeof object === "string" ? encoder.encode(object) : object;
    offsets.push(cursor);
    chunks.push(bytes);
    cursor += bytes.length;
  }
  const count = jpeg ? 6 : 5;
  let xref = `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= count; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer << /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF`;
  chunks.push(encoder.encode(xref));
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let write = 0;
  for (const chunk of chunks) {
    out.set(chunk, write);
    write += chunk.length;
  }
  return out;
}
