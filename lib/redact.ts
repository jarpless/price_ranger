const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g;
const ADDRESS =
  /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Trail)\b\.?/gi;

export interface Redaction {
  text: string;
  tokens: Record<string, string>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactText(input: string, names: string[] = []): Redaction {
  const tokens: Record<string, string> = {};
  let serial = 1;
  let text = input;

  const swap = (value: string, kind: string) => {
    const existing = Object.entries(tokens).find(([, original]) => original === value);
    if (existing) return existing[0];
    const token = `[${kind}-${serial}]`;
    serial += 1;
    tokens[token] = value;
    return token;
  };

  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter((name) => name.length > 1))];
  uniqueNames.sort((a, b) => b.length - a.length);
  for (const name of uniqueNames) {
    text = text.replace(new RegExp(escapeRegExp(name), "gi"), (match) => swap(match, "name"));
  }

  text = text.replace(EMAIL, (match) => swap(match, "email"));
  text = text.replace(PHONE, (match) => swap(match, "phone"));
  text = text.replace(ADDRESS, (match) => swap(match, "address"));

  return { text, tokens };
}

export function restoreText(input: string, tokens: Record<string, string>): string {
  let text = input;
  const ordered = Object.keys(tokens).sort((a, b) => b.length - a.length);
  for (const token of ordered) {
    text = text.split(token).join(tokens[token]);
  }
  return text;
}

export function mergeTokens(
  left: Record<string, string>,
  right: Record<string, string>,
): Record<string, string> {
  return { ...left, ...right };
}
