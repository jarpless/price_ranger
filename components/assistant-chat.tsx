"use client";

import { startAndPriceDirect } from "@/app/guide-actions";
import { PendingLink as Link } from "@/components/pending-link";
import { assistantGreeting, assistantSuggestions, stepLabel, type SavedChat } from "@/lib/assistant/history";
import type { ChatLine } from "@/lib/assistant/presence";
import { priceError } from "@/lib/guide/pricing";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";

import { AssistantMarkdown } from "./assistant-markdown";
import { InfoTip } from "./info-tip";
import { Logo } from "./logo";
import { preparePhoto } from "./prepare-photo";

interface Allowance {
  used: number;
  cap: number;
  remaining: number;
}

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<SpeechAlternative>>;
}

interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function speechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return host.SpeechRecognition || host.webkitSpeechRecognition || null;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AssistantChat({
  mobile,
  popout,
  docked,
  chatId,
  lines,
  draft,
  running,
  pending,
  allowance,
  note,
  tourHref,
  pathname,
  historyOpen,
  chats,
  composerRef,
  onDraft,
  onSend,
  onStop,
  onClose,
  onNewChat,
  onToggleHistory,
  onOpenChat,
  onConfirm,
  onCancel,
  onRetry,
  onPopOut,
  onDock,
  onFloat,
}: {
  mobile: boolean;
  popout: boolean;
  docked: boolean;
  chatId: string;
  lines: ChatLine[];
  draft: string;
  running: boolean;
  pending: { caption: string; choices?: { label: string; args: Record<string, string> }[] } | null;
  allowance: Allowance | null;
  note: string;
  tourHref: string;
  pathname: string;
  historyOpen: boolean;
  chats: SavedChat[];
  composerRef: RefObject<HTMLTextAreaElement | null>;
  onDraft: (value: string) => void;
  onSend: (text?: string) => void;
  onStop: () => void;
  onClose: () => void;
  onNewChat: () => void;
  onToggleHistory: () => void;
  onOpenChat: (id: string) => void;
  onConfirm: (args?: Record<string, string>) => void;
  onCancel: () => void;
  onRetry: (text: string) => void;
  onPopOut: () => void;
  onDock: () => void;
  onFloat: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const seen = useRef("");
  const baseline = useRef<{ chatId: string; count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoForm = useRef<HTMLFormElement>(null);
  const recognition = useRef<SpeechRec | null>(null);
  const [slice, setSlice] = useState<number | null>(null);
  const [away, setAway] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [photoNote, setPhotoNote] = useState("");
  const [canDictate, setCanDictate] = useState(false);
  const [listening, setListening] = useState(false);
  const [greeting, setGreeting] = useState("What are you pricing?");

  const last = lines[lines.length - 1];
  const streamText = last?.role === "assistant" && last.kind !== "step" ? last.text : "";
  const revealing = slice != null && streamText.length > 0 && slice < streamText.length;
  const waiting = running && !revealing && (last?.role !== "assistant" || last.kind === "step");
  const showStop = revealing || (running && !pending);
  const canSend = draft.trim().length > 0;

  useEffect(() => {
    setGreeting(assistantGreeting());
  }, []);

  useEffect(() => {
    setCanDictate(Boolean(speechCtor()));
  }, []);

  useEffect(() => {
    baseline.current = { chatId, count: lines.length };
    seen.current = "";
    setSlice(null);
    // Capture the thread that was already on screen when this chat opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  useEffect(() => {
    if (!streamText) return;
    const key = `${lines.length}:${streamText}`;
    if (seen.current === key) return;
    seen.current = key;
    const existed = baseline.current?.chatId === chatId && lines.length <= (baseline.current?.count ?? 0);
    setSlice(existed ? streamText.length : 0);
  }, [lines, streamText, chatId]);

  useEffect(() => {
    if (slice == null || !streamText || slice >= streamText.length) return;
    const id = window.setInterval(() => {
      setSlice((current) => {
        const at = current ?? 0;
        const step = Math.max(2, Math.round(streamText.length / 56));
        return Math.min(streamText.length, at + step);
      });
    }, 24);
    return () => window.clearInterval(id);
  }, [slice, streamText]);

  useLayoutEffect(() => {
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 192)}px`;
  }, [composerRef, draft]);

  useEffect(() => {
    if (!stick.current) return;
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines, slice, running, pending, historyOpen]);

  useEffect(() => {
    return () => recognition.current?.stop();
  }, []);

  function onScroll() {
    const node = scroller.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    stick.current = distance < 80;
    setAway(distance > 160);
  }

  function jump() {
    const node = scroller.current;
    if (!node) return;
    stick.current = true;
    setAway(false);
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }

  function onComposerKey(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (mobile) return;
    event.preventDefault();
    if (canSend && !running) onSend();
  }

  function choosePhoto(capture: boolean) {
    const input = fileRef.current;
    if (!input) return;
    setAttachOpen(false);
    setPhotoNote("");
    if (capture) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  }

  function onPhoto(file: File | undefined) {
    const input = fileRef.current;
    const form = photoForm.current;
    if (!file || !input || !form) return;
    setPhotoNote("");
    void preparePhoto(file).then((prepared) => {
      if ("error" in prepared) {
        input.value = "";
        setPhotoNote(priceError(prepared.error) || "We couldn't read that photo. Try a smaller JPEG.");
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(prepared.file);
      input.files = transfer.files;
      form.requestSubmit();
    });
  }

  function dictate() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const heard = new Ctor();
    const base = draft.trim();
    heard.lang = "en-US";
    heard.interimResults = true;
    heard.continuous = false;
    heard.onresult = (event) => {
      let said = "";
      for (let index = 0; index < event.results.length; index += 1) {
        said += event.results[index]?.[0]?.transcript || "";
      }
      onDraft(`${base} ${said}`.replace(/\s+/g, " ").trim());
    };
    heard.onerror = () => {
      recognition.current = null;
      setListening(false);
    };
    heard.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = heard;
    setListening(true);
    heard.start();
  }

  async function copyLine(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }

  function priorUser(index: number): string {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const line = lines[cursor];
      if (line?.role === "user") return line.text;
    }
    return "";
  }

  const suggestions = assistantSuggestions(pathname);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-paper text-ink">
      <header className="ask-top flex items-center gap-2 border-b border-line px-3 pb-2">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink"
          aria-label={historyOpen ? "Back to chat" : popout ? "Close window" : "Close chat"}
          onClick={() => {
            if (historyOpen) onToggleHistory();
            else onClose();
          }}
        >
          <Chevron />
        </button>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pine">
          <Logo tone="light" width={22} height={22} className="h-5 w-5" alt="" />
        </span>
        <h1 className="min-w-0 truncate font-serif text-lg leading-none">Price Ranger</h1>
        <div className="ml-auto flex items-center">
          {!mobile && !popout ? (
            <>
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label="Open in new window" onClick={onPopOut}>
                <PopOutIcon />
              </button>
              {docked ? (
                <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label="Float" onClick={onFloat}>
                  <FloatIcon />
                </button>
              ) : (
                <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label="Open in side panel" onClick={onDock}>
                  <DockIcon />
                </button>
              )}
            </>
          ) : null}
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full"
            aria-label="Chat history"
            aria-pressed={historyOpen}
            onClick={onToggleHistory}
          >
            <HistoryIcon />
          </button>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full" aria-label="New chat" onClick={onNewChat}>
            <NewChatIcon />
          </button>
        </div>
      </header>

      <div className="ask-column">
        {allowance ? (
          <p className="flex items-center px-5 pt-3 text-sm text-muted">
            {allowance.used} of {allowance.cap} used this month
            <InfoTip id="messages" />
            {allowance.remaining <= 2 ? (
              <Link href="/upgrade" className="ml-2 font-semibold text-pine">
                Upgrade
              </Link>
            ) : null}
          </p>
        ) : null}

        {historyOpen ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" role="list" aria-label="Chat history">
            {chats.length === 0 ? <p className="px-2 py-8 text-center text-base text-muted">No past chats yet.</p> : null}
            <ul className="space-y-1">
              {chats.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    className={`flex w-full items-baseline gap-3 rounded-2xl px-3 py-3 text-left ${chat.id === chatId ? "bg-cream" : ""}`}
                    onClick={() => onOpenChat(chat.id)}
                  >
                    <span className="min-w-0 flex-1 truncate text-base font-semibold">{chat.title}</span>
                    <span className="shrink-0 text-sm text-muted">{when(chat.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <div className="relative min-h-0 flex-1">
            <div
              ref={scroller}
              className="ask-thread h-full overflow-y-auto"
              role="log"
              aria-label="Conversation"
              aria-busy={running || undefined}
              onScroll={onScroll}
            >
              {lines.length === 0 ? (
                <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pine">
                    <Logo tone="light" width={40} height={40} className="h-10 w-10" alt="" />
                  </span>
                  <p className="mt-5 max-w-sm font-serif text-2xl leading-snug">{greeting}</p>
                  <div className="mt-6 flex max-w-md flex-wrap justify-center gap-2">
                    {suggestions.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="h-11 rounded-full border border-line bg-paper px-4 text-base font-semibold text-ink"
                        onClick={() => onSend(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 px-4 py-6 sm:px-5">
                  {lines.map((line, index) => {
                    if (line.role === "user") {
                      return (
                        <p key={`${chatId}-user-${index}`} className="ml-auto w-fit max-w-[85%] rounded-3xl bg-cream px-4 py-2.5 text-base leading-7">
                          {line.text}
                        </p>
                      );
                    }
                    if (line.kind === "step") {
                      return (
                        <div key={`${chatId}-step-${index}`} className="ask-step">
                          <span className="ask-step-mark" aria-hidden="true">
                            <CheckIcon />
                          </span>
                          <span className="ask-step-label">{stepLabel(line.text)}</span>
                        </div>
                      );
                    }
                    const shown = index === lines.length - 1 && slice != null ? line.text.slice(0, slice) : line.text;
                    const done = index !== lines.length - 1 || !revealing;
                    const again = priorUser(index);
                    return (
                      <div key={`${chatId}-assistant-${index}`} className="text-base leading-7">
                        <AssistantMarkdown text={shown} />
                        {index === lines.length - 1 && revealing ? <span className="ask-caret" aria-hidden="true" /> : null}
                        {done ? (
                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              className="h-9 rounded-full px-3 text-sm font-semibold text-muted"
                              aria-label="Copy reply"
                              onClick={() => void copyLine(index, line.text)}
                            >
                              {copied === index ? "Copied" : "Copy"}
                            </button>
                            {again ? (
                              <button
                                type="button"
                                className="h-9 rounded-full px-3 text-sm font-semibold text-muted"
                                aria-label="Retry"
                                onClick={() => onRetry(again)}
                              >
                                Retry
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {waiting ? (
                    <div className="ask-shimmer" role="status" aria-label="Price Ranger is writing">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : null}
                  {pending ? (
                    <div className="rounded-3xl border border-line bg-paper p-4">
                      <p className="text-base leading-7">{pending.caption}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(pending.choices || []).length > 1 ? (
                          pending.choices?.map((choice) => (
                            <button
                              key={choice.label}
                              type="button"
                              className="h-auto min-h-11 max-w-full whitespace-normal rounded-full bg-pine px-4 py-2 text-center text-base font-semibold leading-6 text-cream"
                              onClick={() => onConfirm(choice.args)}
                            >
                              {choice.label}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            className="h-11 rounded-full bg-pine px-4 text-base font-semibold text-cream"
                            onClick={() => onConfirm(pending.choices?.[0]?.args)}
                          >
                            Confirm
                          </button>
                        )}
                        <button type="button" className="h-11 rounded-full px-4 text-base font-semibold text-muted" onClick={onCancel}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {tourHref ? (
                    <Link href={tourHref} className="block text-base font-semibold text-pine">
                      Replay this as a guided tour
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
            {away ? (
              <button
                type="button"
                className="absolute bottom-3 left-1/2 z-10 h-10 -translate-x-1/2 rounded-full border border-line bg-paper px-4 text-sm font-semibold shadow-card"
                aria-label="Jump to latest"
                onClick={jump}
              >
                Jump to latest
              </button>
            ) : null}
            </div>

            <div className="ask-composer">
              {note ? <p className="mb-2 px-2 text-sm leading-6 text-muted">{note}</p> : null}
              {photoNote ? <p className="mb-2 rounded-2xl bg-[#f8e8e4] px-3 py-2 text-sm text-danger">{photoNote}</p> : null}
              <form ref={photoForm} action={startAndPriceDirect} className="hidden">
                <input type="hidden" name="path" value="item" />
                <input
                  ref={fileRef}
                  name="photo"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => onPhoto(event.target.files?.[0])}
                />
              </form>
              <div className="ask-composer-shell relative flex items-end gap-1 rounded-[1.75rem] border border-line bg-paper px-1.5 py-1.5 shadow-card">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink"
                  aria-label="Attach or take a photo"
                  aria-expanded={attachOpen}
                  aria-haspopup="menu"
                  onClick={() => setAttachOpen((open) => !open)}
                >
                  <PlusIcon />
                </button>
                {attachOpen ? (
                  <div role="menu" aria-label="Attach" className="absolute bottom-14 left-2 z-10 w-48 rounded-2xl border border-line bg-paper p-1 shadow-card">
                    <button type="button" role="menuitem" className="block h-11 w-full rounded-xl px-3 text-left text-base font-semibold" onClick={() => choosePhoto(true)}>
                      Take a photo
                    </button>
                    <button type="button" role="menuitem" className="block h-11 w-full rounded-xl px-3 text-left text-base font-semibold" onClick={() => choosePhoto(false)}>
                      Choose a photo
                    </button>
                  </div>
                ) : null}
                <textarea
                  ref={composerRef}
                  value={draft}
                  rows={1}
                  placeholder="Ask Price Ranger..."
                  aria-label="Ask Price Ranger"
                  enterKeyHint="enter"
                  className="ask-composer-input max-h-48 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-base leading-6"
                  onChange={(event) => onDraft(event.target.value)}
                  onKeyDown={onComposerKey}
                />
                {canDictate ? (
                  <button
                    type="button"
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${listening ? "bg-cream text-pine" : "text-ink"}`}
                    aria-label={listening ? "Stop dictation" : "Dictate"}
                    aria-pressed={listening}
                    onClick={dictate}
                  >
                    <MicIcon />
                  </button>
                ) : null}
                {showStop ? (
                  <button type="button" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8d3b32] text-cream" aria-label="Stop" onClick={onStop}>
                    <StopIcon />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${canSend ? "bg-pine text-cream" : "bg-[#e7e1d6] text-[#8a8175]"}`}
                    aria-label="Send message"
                    disabled={!canSend}
                    onClick={() => onSend()}
                  >
                    <ArrowUpIcon />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 19V6M6.5 11.5 12 6l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <rect width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12 5 5 9-10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NewChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19.5 6.2 15 16.5 4.7a1.8 1.8 0 0 1 2.5 2.5L8.7 17.6 5 19.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14.2 7 17 9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PopOutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14 5h5v5M19 5l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13.5V18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 5v14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function FloatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7" y="4" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 10v8a2 2 0 0 0 2 2h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
