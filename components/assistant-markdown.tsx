import { PendingLink as Link } from "@/components/pending-link";
import { Fragment, type ReactNode } from "react";

import { markdownBlocks } from "@/lib/assistant/markdown";

function inline(text: string, key: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const id = `${key}-${index}`;
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={id}>{bold[1]}</strong>;
    const code = part.match(/^`([^`]+)`$/);
    if (code) {
      return (
        <code key={id} className="rounded bg-cream px-1">
          {code[1]}
        </code>
      );
    }
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
  const blocks = markdownBlocks(text);
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "p") {
          return (
            <p key={`p-${index}`} className="whitespace-pre-wrap">
              {inline(block.text, `p-${index}`)}
            </p>
          );
        }
        const Tag = block.type === "ol" ? "ol" : "ul";
        return (
          <Tag key={`${block.type}-${index}`} className={`${block.type === "ol" ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item, `${block.type}-${index}-${itemIndex}`)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
