export type MarkdownBlock =
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

/** Close markers that have not finished arriving so the reply never shows raw `**`. */
export function settleMarkdown(text: string): string {
  let value = text.replace(/\r\n/g, "\n");
  if ((value.match(/```/g) || []).length % 2 === 1) value += "\n```";
  value = value.replace(/\[[^\]\n]*$/, "");
  value = value.replace(/\[([^\]\n]+)\]\([^)\n]*$/, "$1");
  if (value.endsWith("*") && !value.endsWith("**")) value = value.slice(0, -1);
  if ((value.match(/\*\*/g) || []).length % 2 === 1) value += "**";
  const outsideFence = value.replace(/```[\s\S]*?```/g, "");
  if ((outsideFence.match(/`/g) || []).length % 2 === 1) value += "`";
  return value;
}

function isItem(line: string, kind: "ul" | "ol"): boolean {
  return kind === "ul" ? /^\s*[-*]\s+\S/.test(line) : /^\s*\d+\.\s+\S/.test(line);
}

function itemText(line: string, kind: "ul" | "ol"): string {
  return kind === "ul" ? line.replace(/^\s*[-*]\s+/, "") : line.replace(/^\s*\d+\.\s+/, "");
}

function takeList(lines: string[], index: number, kind: "ul" | "ol"): { items: string[]; next: number } {
  const items: string[] = [];
  let cursor = index;
  while (cursor < lines.length) {
    const line = lines[cursor] ?? "";
    if (isItem(line, kind)) {
      items.push(itemText(line, kind));
      cursor += 1;
      continue;
    }
    if (!line.trim()) {
      let look = cursor + 1;
      while (look < lines.length && !(lines[look] ?? "").trim()) look += 1;
      if (isItem(lines[look] ?? "", kind)) {
        cursor += 1;
        continue;
      }
    }
    break;
  }
  return { items, next: cursor };
}

export function markdownBlocks(raw: string): MarkdownBlock[] {
  const lines = settleMarkdown(raw).split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isItem(line, "ul") || isItem(line, "ol")) {
      const kind = isItem(line, "ol") ? "ol" : "ul";
      const list = takeList(lines, index, kind);
      blocks.push({ type: kind, items: list.items });
      index = list.next;
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    blocks.push({ type: "p", text: line });
    index += 1;
  }
  return blocks;
}
