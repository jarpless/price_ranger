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
  seller?: string;
  date?: string;
}

/** Helvetica uses WinAnsi, not UTF-8. × is byte 0xD7; a UTF-8 write renders as ˆ. */
const WIN_ANSI: Record<string, number> = {
  "\u00a0": 0x20,
  "\u00d7": 0xd7,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u2212": 0x96,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201c": 0x93,
  "\u201d": 0x94,
  "\u2022": 0x95,
  "\u00a9": 0xa9,
};

export function encodeWinAnsi(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const char of value) {
    const mapped = WIN_ANSI[char];
    if (mapped != null) {
      bytes.push(mapped);
      continue;
    }
    const code = char.charCodeAt(0);
    if (code === 0x5c || code === 0x28 || code === 0x29) {
      bytes.push(0x5c, code);
      continue;
    }
    if (code >= 32 && code <= 126) {
      bytes.push(code);
      continue;
    }
    if (code >= 160 && code <= 255) {
      bytes.push(code);
      continue;
    }
    bytes.push(0x3f);
  }
  return Uint8Array.from(bytes);
}

function escapePdf(value: string): string {
  return Buffer.from(encodeWinAnsi(value)).toString("latin1");
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
  commands.push(`BT /F1 11 Tf 48 ${y} Td (${escapePdf("Price Ranger")}) Tj ET`);
  const stamp = [input.date, input.seller].filter(Boolean).join("  ·  ").slice(0, 80);
  if (stamp) {
    commands.push(`BT /F1 10 Tf 320 ${y} Td (${escapePdf(stamp)}) Tj ET`);
  }
  y -= 28;
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
    const maxW = 220;
    const room = Math.max(72, y - 56);
    const maxH = Math.min(200, room);
    const scale = Math.min(maxW / size.width, maxH / size.height, 1);
    const width = Math.max(1, Math.round(size.width * scale));
    const height = Math.max(1, Math.round(size.height * scale));
    const imageY = Math.max(48, y - 16 - height);
    commands.push(`q ${width} 0 0 ${height} 48 ${imageY} cm /Im1 Do Q`);
  }
  const stream = commands.join("\n");
  const streamBytes = Uint8Array.from(stream, (char) => char.charCodeAt(0) & 0xff);

  const objects: (string | Uint8Array)[] = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n");
  objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n");
  const imageRef = jpeg ? " /XObject << /Im1 6 0 R >>" : "";
  objects.push(
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >>${imageRef} >> >> endobj\n`,
  );
  const streamHeader = new TextEncoder().encode(`4 0 obj << /Length ${streamBytes.length} >> stream\n`);
  const streamFooter = new TextEncoder().encode("\nendstream endobj\n");
  const streamObject = new Uint8Array(streamHeader.length + streamBytes.length + streamFooter.length);
  streamObject.set(streamHeader, 0);
  streamObject.set(streamBytes, streamHeader.length);
  streamObject.set(streamFooter, streamHeader.length + streamBytes.length);
  objects.push(streamObject);
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
