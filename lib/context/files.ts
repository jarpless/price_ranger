import { inflateRawSync, inflateSync } from "node:zlib";

import { CONTEXT_LIMITS, contextKind, type ContextKind } from "./kinds";

export { CONTEXT_ACCEPT, CONTEXT_LIMITS, contextFileProblem, contextKind, type ContextKind } from "./kinds";

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Reads named entries from a zip archive. XLSX and DOCX are zip files of XML. */
export function readZip(bytes: Uint8Array, wanted: (name: string) => boolean): Map<string, string> {
  const out = new Map<string, string>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) return out;
  const count = view.getUint16(end + 10, true);
  let pointer = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (let n = 0; n < count && pointer + 46 <= bytes.length; n += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;
    const method = view.getUint16(pointer + 10, true);
    const compressed = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const local = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
    pointer += 46 + nameLength + extraLength + commentLength;
    if (!wanted(name) || local + 30 > bytes.length) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + compressed);
    try {
      const raw = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
      if (raw) out.set(name, decoder.decode(raw));
    } catch {
      continue;
    }
  }
  return out;
}

function columnIndex(ref: string): number {
  const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return Math.max(0, index - 1);
}

/** Each worksheet as tab-separated text, in workbook order. */
export function xlsxSheets(bytes: Uint8Array): { name: string; text: string }[] {
  const files = readZip(bytes, (name) => name === "xl/sharedStrings.xml" || name === "xl/workbook.xml" || /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  const shared = [...(files.get("xl/sharedStrings.xml") || "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeEntities([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join("")),
  );
  const names = [...(files.get("xl/workbook.xml") || "").matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((match) => decodeEntities(match[1]));
  const sheets = [...files.keys()]
    .filter((name) => name.startsWith("xl/worksheets/"))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)?.[1]) - Number(b.match(/(\d+)\.xml$/)?.[1]));
  return sheets.map((path, index) => {
    const xml = files.get(path) || "";
    const rows: string[] = [];
    for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cell[1];
        const body = cell[2] || "";
        const ref = attrs.match(/\br="([A-Z]+)\d+"/i)?.[1] || "";
        const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
        let value = "";
        if (type === "inlineStr") value = decodeEntities([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""));
        else {
          const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
          value = type === "s" ? shared[Number(raw)] ?? "" : decodeEntities(raw);
        }
        const at = ref ? columnIndex(ref) : cells.length;
        while (cells.length < at) cells.push("");
        cells[at] = value.replace(/[\t\r\n]+/g, " ").trim();
      }
      if (cells.some(Boolean)) rows.push(cells.join("\t"));
    }
    return { name: names[index] || `Sheet ${index + 1}`, text: rows.join("\n") };
  });
}

export function docxText(bytes: Uint8Array): string {
  const xml = readZip(bytes, (name) => name === "word/document.xml").get("word/document.xml") || "";
  return decodeEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<w:br\/>|<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\t+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pdfString(raw: string): string {
  return raw.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, code: string) => {
    if (/^[0-7]+$/.test(code)) return String.fromCharCode(parseInt(code, 8));
    return ({ n: "\n", r: "", t: "\t", b: "", f: "", "(": "(", ")": ")", "\\": "\\" } as Record<string, string>)[code] ?? "";
  });
}

/**
 * Best-effort text from a simple, text-based PDF. Used only when no AI model is set up;
 * the model reads the PDF itself, including scans.
 */
export function pdfText(bytes: Uint8Array): string {
  const binary = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of binary.matchAll(streams)) {
    const header = binary.slice(Math.max(0, (match.index ?? 0) - 300), match.index);
    let body = match[1];
    if (/FlateDecode/.test(header)) {
      try {
        body = inflateSync(Buffer.from(body, "latin1")).toString("latin1");
      } catch {
        continue;
      }
    } else if (/\/Filter/.test(header)) continue;
    if (!/\bBT\b/.test(body)) continue;
    let line = "";
    for (const op of body.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj|\[(?:\\.|[^\]])*\]\s*TJ|\((?:\\.|[^\\)])*\)\s*'|T\*|-?[\d.]+\s+-?[\d.]+\s+T[dD]|ET/g)) {
      const token = op[0];
      if (token.endsWith("Tj") || token.endsWith("'")) {
        if (token.endsWith("'") && line) {
          chunks.push(line);
          line = "";
        }
        line += pdfString(token.slice(token.indexOf("(") + 1, token.lastIndexOf(")")));
      } else if (token.endsWith("TJ")) {
        for (const part of token.matchAll(/\(((?:\\.|[^\\)])*)\)|(-?\d+(?:\.\d+)?)/g)) {
          if (part[1] != null) line += pdfString(part[1]);
          else if (Number(part[2]) < -200) line += " ";
        }
      } else if (token === "ET" || token === "T*" || /T[dD]$/.test(token)) {
        const moves = /T[dD]$/.test(token) ? Number(token.trim().split(/\s+/)[1]) : -1;
        if (moves === 0 && line) {
          line += " ";
          continue;
        }
        if (line.trim()) chunks.push(line);
        line = "";
      }
    }
    if (line.trim()) chunks.push(line);
  }
  return chunks
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, CONTEXT_LIMITS.textChars);
}

const TIMESTAMP = /^\[?\(?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\)?\]?\s*/;

/** Strips cue numbers, timestamps, and speaker tags from a VTT, SRT, or pasted call transcript. */
export function cleanTranscript(text: string): string {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    let line = raw.trim();
    if (!line || line === "WEBVTT" || /^NOTE\b/.test(line) || /^\d+$/.test(line)) continue;
    if (/-->/.test(line)) continue;
    line = line.replace(TIMESTAMP, "");
    line = line.replace(/^<v\s+[^>]+>/i, "").replace(/<\/?[^>]+>/g, "");
    line = line.replace(/^(?:speaker\s*\d+|[A-Z][\w.'-]*(?:\s[A-Z][\w.'-]*)?)\s*(?:\(\d{1,2}:\d{2}(?::\d{2})?\))?\s*:\s+(?=\S)/, "");
    line = line.replace(TIMESTAMP, "");
    if (line) out.push(line);
  }
  return out.join("\n");
}

export function looksLikeTranscript(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.length < 3) return false;
  if (/^WEBVTT/.test(text.trim()) || /-->/.test(text)) return true;
  const tagged = lines.filter((line) => TIMESTAMP.test(line.trim()) || /^(speaker\s*\d+|[A-Z][a-z]+)\s*(\(\d{1,2}:\d{2}\))?:\s/i.test(line.trim())).length;
  return tagged / lines.length >= 0.5;
}

export interface ReadContext {
  name: string;
  kind: ContextKind;
  text: string;
  tabular: boolean;
}

/** Turns one uploaded file into text the rules parser and the model can read. Photos and PDFs also go to the model as-is. */
export function readContextFile(name: string, mime: string, bytes: Uint8Array): ReadContext[] {
  const kind = contextKind(name, mime);
  const decode = () => new TextDecoder().decode(bytes).replace(/^\uFEFF/, "").slice(0, CONTEXT_LIMITS.textChars);
  if (kind === "sheet") {
    return xlsxSheets(bytes)
      .filter((sheet) => sheet.text.trim())
      .map((sheet, index, all) => ({ name: all.length > 1 ? `${name} · ${sheet.name}` : name, kind, text: sheet.text.slice(0, CONTEXT_LIMITS.textChars), tabular: true }));
  }
  if (kind === "csv") return [{ name, kind, text: decode(), tabular: true }];
  if (kind === "doc") return [{ name, kind, text: docxText(bytes).slice(0, CONTEXT_LIMITS.textChars), tabular: false }];
  if (kind === "pdf") return [{ name, kind, text: pdfText(bytes), tabular: false }];
  if (kind === "transcript") return [{ name, kind, text: cleanTranscript(decode()), tabular: false }];
  if (kind === "text") {
    const text = decode();
    return [{ name, kind: looksLikeTranscript(text) ? "transcript" : "text", text: looksLikeTranscript(text) ? cleanTranscript(text) : text, tabular: false }];
  }
  return [{ name, kind, text: "", tabular: false }];
}
