import type { AskMode, ChatLine, ChatTurn } from "./presence";

export type SavedChat = {
  id: string;
  title: string;
  updatedAt: string;
  lines: ChatLine[];
  turns: ChatTurn[];
  mode: AskMode;
};

const HISTORY_KEY = "pr-assistant-history-v1";
const MAX_CHATS = 40;

export function assistantGreeting(now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return `${part}, what are you pricing?`;
}

export function assistantSuggestions(pathname: string): string[] {
  if (pathname.startsWith("/guide")) {
    return ["What is this worth?", "How do I share this?", "How do I mark it sold?", "Change the price"];
  }
  return ["What is this worth?", "How do I share a price?", "What plan am I on?", "How do I add a photo?"];
}

export function chatTitle(lines: ChatLine[]): string {
  const first = lines.find((line) => line.role === "user")?.text.replace(/\s+/g, " ").trim() || "New chat";
  if (first.length <= 48) return first;
  return `${first.slice(0, 48).trim()}…`;
}

export function stepLabel(caption: string): string {
  const price = caption.match(/\$[\d,]+(?:\.\d{2})?/);
  if (/change this quote/i.test(caption) && price) return `Changed price to ${price[0]}`;
  if (/mark .+ sold/i.test(caption)) return price ? `Marked sold at ${price[0]}` : "Marked sold";
  const opened = caption.match(/^Open\s+([^.?!]+)/i);
  if (opened) return `Opened ${opened[1].trim()}`;
  const sentence = caption.split(/[.!?]/)[0]?.trim() || caption.trim();
  if (sentence.length <= 72 || /\(total\s+\$/i.test(sentence)) return sentence;
  return `${sentence.slice(0, 72).trim()}…`;
}

export function upsertChat(list: SavedChat[], chat: SavedChat): SavedChat[] {
  const next = [chat, ...list.filter((item) => item.id !== chat.id)];
  next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return next.slice(0, MAX_CHATS);
}

function validChat(value: unknown): SavedChat | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SavedChat>;
  if (!row.id || typeof row.id !== "string") return null;
  if (!Array.isArray(row.lines) || !Array.isArray(row.turns)) return null;
  return {
    id: row.id,
    title: typeof row.title === "string" && row.title.trim() ? row.title : chatTitle(row.lines as ChatLine[]),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
    lines: row.lines as ChatLine[],
    turns: row.turns as ChatTurn[],
    mode: row.mode === "agent" ? "agent" : "ask",
  };
}

export function readChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry) => {
      const chat = validChat(entry);
      return chat ? [chat] : [];
    }).slice(0, MAX_CHATS);
  } catch {
    return [];
  }
}

export function writeChats(chats: SavedChat[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)));
}
