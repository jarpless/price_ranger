export type ContextKind = "image" | "pdf" | "sheet" | "csv" | "doc" | "text" | "transcript" | "unsupported";

export const CONTEXT_LIMITS = {
  files: 8,
  fileBytes: 4_000_000,
  totalBytes: 4_200_000,
  textChars: 20_000,
  pastedChars: 20_000,
  modelChars: 40_000,
} as const;

export const CONTEXT_ACCEPT =
  "image/*,application/pdf,.pdf,.csv,.tsv,.txt,.md,.vtt,.srt,.json,.xlsx,.docx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function contextKind(name: string, mime = ""): ContextKind {
  const lower = name.toLowerCase();
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".") + 1) : "";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (ext === "xlsx" || mime.includes("spreadsheetml")) return "sheet";
  if (ext === "csv" || ext === "tsv" || mime === "text/csv" || mime === "text/tab-separated-values") return "csv";
  if (ext === "docx" || mime.includes("wordprocessingml")) return "doc";
  if (ext === "vtt" || ext === "srt" || mime === "text/vtt") return "transcript";
  if (["txt", "md", "json", "text"].includes(ext) || mime.startsWith("text/")) return "text";
  return "unsupported";
}

/** Why a file can't be read, in words a seller understands. Null when it can. */
export function contextFileProblem(name: string, mime: string, size: number): string | null {
  const kind = contextKind(name, mime);
  const lower = name.toLowerCase();
  if (kind === "unsupported") {
    if (/\.(xls|numbers)$/.test(lower)) return `${name}: save it as .xlsx or .csv first.`;
    if (/\.(doc|pages|rtf)$/.test(lower)) return `${name}: save it as .docx or PDF first.`;
    return `${name}: we can read photos, PDF, CSV, Excel, Word and text files.`;
  }
  if (kind === "image" && /\.(heic|heif)$/.test(lower)) return `${name}: this photo format can't be read here. Use JPEG or PNG.`;
  if (size > CONTEXT_LIMITS.fileBytes) return `${name} is over 4 MB. Try a smaller file.`;
  if (size <= 0) return `${name} is empty.`;
  return null;
}
