import { MARK_JPEG_HEX } from "./mark-jpeg";

const MARK_JPEG = Uint8Array.from(Buffer.from(MARK_JPEG_HEX, "hex"));

export interface PdfLine {
  name: string;
  detail: string;
  price: string;
}

export interface PdfComparable {
  title: string;
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
  condition?: string;
  range?: string;
  comparables?: PdfComparable[];
}

/** A download name that stops on a word, so a long title is not cut in half. */
export function pdfFilename(title: string, date: string): string {
  const words = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  let slug = "";
  for (const word of words) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > 48) break;
    slug = next;
  }
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  return `price-ranger-${slug || "price"}${day ? `-${day}` : ""}.pdf`;
}

/** Helvetica uses WinAnsi, not UTF-8. × is byte 0xD7; a UTF-8 write renders as ˆ. */
const WIN_ANSI: Record<string, number> = {
  "\u00a0": 0x20,
  "\u00d7": 0xd7,
  "\u2013": 0x2d,
  "\u2014": 0x2d,
  "\u2212": 0x2d,
  "\u2010": 0x2d,
  "\u2011": 0x2d,
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

/** Break on spaces so a price such as $200 is never cut to $20. */
export function pdfRows(value: string, width: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const rows: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > width) {
      rows.push(line);
      line = word;
      continue;
    }
    line = next;
  }
  if (line) rows.push(line);
  return rows;
}

function writeRows(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size: number,
  width: number,
  leading: number,
): number {
  for (const row of pdfRows(text, width)) {
    if (y < 64) break;
    commands.push(`BT /F1 ${size} Tf ${x} ${y} Td (${escapePdf(row)}) Tj ET`);
    y -= leading;
  }
  return y;
}

/** A real one-page PDF. A JPEG is embedded when the photo is a JPEG. */
export function buildPricePdf(input: PdfInput): Uint8Array {
  const jpeg = input.jpeg && jpegSize(input.jpeg) ? input.jpeg : null;
  const size = jpeg ? jpegSize(jpeg) : null;
  const logo = jpegSize(MARK_JPEG) ? MARK_JPEG : null;
  const commands: string[] = [];
  commands.push("0.118 0.275 0.212 rg");
  commands.push("0 708 612 84 re f");
  if (logo) commands.push("q 56 0 0 56 32 722 cm /ImLogo Do Q");
  commands.push("1 1 1 rg");
  commands.push("BT /F1 18 Tf 100 746 Td (Price Ranger) Tj ET");
  commands.push("0.118 0.275 0.212 rg");
  let y = 684;
  const stamp = ["priceranger.app", input.date].filter(Boolean).join("  ·  ").slice(0, 80);
  commands.push(`BT /F1 10 Tf 48 ${y} Td (${escapePdf(stamp)}) Tj ET`);
  y -= 28;
  commands.push(`BT /F1 20 Tf 48 ${y} Td (${escapePdf(input.title.slice(0, 72))}) Tj ET`);
  y -= 22;
  const facts = [input.condition, input.range].filter(Boolean).join("  ·  ");
  if (facts) {
    y = writeRows(commands, facts, 48, y, 11, 78, 16);
    y -= 2;
  }
  if (input.subtitle && input.subtitle.trim().toLowerCase() !== input.title.trim().toLowerCase()) {
    y = writeRows(commands, input.subtitle, 48, y, 12, 72, 16);
    y -= 12;
  } else {
    y -= 8;
  }
  const lines = input.lines;
  for (const line of lines.slice(0, 18)) {
    if (y < 72) break;
    commands.push(`BT /F1 12 Tf 48 ${y} Td (${escapePdf(line.name.slice(0, 48))}) Tj ET`);
    commands.push(`BT /F1 12 Tf 400 ${y} Td (${escapePdf(line.price.slice(0, 24))}) Tj ET`);
    y -= 16;
    y = writeRows(commands, line.detail, 48, y, 10, 78, 14);
    y -= 6;
  }
  y -= 8;
  commands.push(`BT /F1 16 Tf 48 ${y} Td (${escapePdf(`Total ${input.total}`)}) Tj ET`);
  const comps = (input.comparables || []).slice(0, 4);
  if (comps.length > 0) {
    y -= 28;
    commands.push(`BT /F1 12 Tf 48 ${y} Td (Comparables) Tj ET`);
    y -= 18;
    for (const comp of comps) {
      if (y < 72) break;
      y = writeRows(commands, comp.title, 48, y, 10, 62, 14);
      commands.push(`BT /F1 10 Tf 430 ${y + 14} Td (${escapePdf(comp.price.slice(0, 16))}) Tj ET`);
      if (comp.detail) {
        y = writeRows(commands, comp.detail, 48, y, 9, 78, 12);
        y -= 4;
      }
    }
  }
  if (size) {
    const maxW = 320;
    const room = Math.max(120, y - 48);
    const maxH = Math.min(280, room);
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
  const logoSize = logo ? jpegSize(logo) : null;
  const xobjects = [
    logo && logoSize ? "/ImLogo 6 0 R" : "",
    jpeg && size ? `/Im1 ${logo && logoSize ? 7 : 6} 0 R` : "",
  ].filter(Boolean);
  const imageRef = xobjects.length ? ` /XObject << ${xobjects.join(" ")} >>` : "";
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
  function imageObject(id: number, bytes: Uint8Array, dimensions: { width: number; height: number }) {
    const header = new TextEncoder().encode(
      `${id} 0 obj << /Type /XObject /Subtype /Image /Width ${dimensions.width} /Height ${dimensions.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >> stream\n`,
    );
    const footer = new TextEncoder().encode("\nendstream endobj\n");
    const combined = new Uint8Array(header.length + bytes.length + footer.length);
    combined.set(header, 0);
    combined.set(bytes, header.length);
    combined.set(footer, header.length + bytes.length);
    return combined;
  }
  let nextId = 6;
  if (logo && logoSize) {
    objects.push(imageObject(nextId, logo, logoSize));
    nextId += 1;
  }
  if (jpeg && size) objects.push(imageObject(nextId, jpeg, size));

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
  const count = objects.length;
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
