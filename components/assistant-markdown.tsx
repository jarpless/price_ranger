import { PendingLink as Link } from "@/components/pending-link";
import { Fragment, type ReactNode } from "react";

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const id = `${key}-${index}`;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={id}>{bold[1]}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && link[2].startsWith("/") && !link[2].startsWith("//")) {
      return (
        <Link key={id} href={link[2]} className="font-semibold text-pine underline">
          {link[1]}
        </Link>
      );
    }
    return <Fragment key={id}>{part}</Fragment>;
  });
}

export function AssistantMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      const start = index;
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*[-*]\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ul key={`ul-${start}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item, `ul-${start}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      const start = index;
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index] ?? "")) {
        items.push((lines[index] ?? "").replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push(
        <ol key={`ol-${start}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item, `ol-${start}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (!line.trim()) {
      index += 1;
      continue;
    }
    blocks.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap">
        {inline(line, `p-${index}`)}
      </p>,
    );
    index += 1;
  }
  return <div className="space-y-3">{blocks}</div>;
}
