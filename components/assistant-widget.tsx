"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { BuildStamp } from "@/lib/build-info";

import { Logo } from "./logo";
import { Spotlight } from "./spotlight";

interface ChatLine {
  role: "user" | "assistant";
  text: string;
}

interface Step {
  name: string;
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
}

interface Turn {
  role: "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

function renderText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return <span key={index}>{part}</span>;
    const href = match[2];
    if (!href.startsWith("/")) return <span key={index}>{match[1]}</span>;
    return (
      <Link key={index} href={href} className="font-semibold text-pine underline">
        {match[1]}
      </Link>
    );
  });
}

async function wait(ms: number, stop: () => boolean) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if (stop()) return false;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return true;
}

export function AssistantWidget({ signedIn }: { stamp: BuildStamp; signedIn: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"ask" | "agent">("ask");
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Step | null>(null);
  const [spotlight, setSpotlight] = useState<{ selector: string; caption: string } | null>(null);
  const [tourHref, setTourHref] = useState("");
  const stopRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  const playedRef = useRef<{ caption: string; href: string; spotlight: string }[]>([]);
  const promptRef = useRef("");

  function stop() {
    stopRef.current = true;
    setPending(null);
    setSpotlight(null);
    setRunning(false);
    void saveTour();
  }

  async function saveTour() {
    const steps = playedRef.current;
    if (steps.length === 0 || !promptRef.current) return;
    const response = await fetch("/api/assistant/tour", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: promptRef.current.slice(0, 80),
        prompt: promptRef.current,
        steps,
      }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { id?: string };
    if (payload.id) setTourHref(`/tours/${payload.id}`);
    playedRef.current = [];
  }

  async function play(step: Step, confirmed = false) {
    setSpotlight({ selector: step.spotlight, caption: step.caption });
    if (step.href.startsWith("/") && !step.href.startsWith("//")) {
      router.push(step.href);
    }
    const stayed = await wait(700, () => stopRef.current);
    if (!stayed) return false;
    if (step.name === "navigate") {
      playedRef.current.push({ caption: step.caption, href: step.href, spotlight: step.spotlight });
      return true;
    }
    const response = await fetch("/api/assistant/act", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: step.name, args: step.args, confirmed }),
    });
    const effect = (await response.json()) as {
      ok?: boolean;
      summary?: string;
      href?: string;
      spotlight?: string;
      error?: string;
    };
    if (!response.ok) {
      setLines((current) => [...current, { role: "assistant", text: effect.error || "That step did not run." }]);
      return false;
    }
    if (effect.href) router.push(effect.href);
    router.refresh();
    const spotlightId = effect.spotlight || step.spotlight;
    setSpotlight({ selector: spotlightId, caption: step.caption });
    playedRef.current.push({ caption: step.caption, href: effect.href || step.href, spotlight: spotlightId });
    turnsRef.current.push({ role: "tool", name: step.name, content: effect.summary || "Done." });
    const still = await wait(900, () => stopRef.current);
    return still;
  }

  async function run(extraTurns?: Turn[]) {
    if (!signedIn) {
      setLines((current) => [...current, { role: "assistant", text: "Sign in to ask about your quotes." }]);
      return;
    }
    setRunning(true);
    stopRef.current = false;
    let guard = 0;
    while (guard < 6 && !stopRef.current) {
      guard += 1;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          pathname,
          turns: extraTurns || turnsRef.current,
        }),
      });
      const payload = (await response.json()) as {
        type?: string;
        text?: string;
        note?: string;
        steps?: Step[];
        continue?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setLines((current) => [...current, { role: "assistant", text: payload.error || payload.text || "The assistant could not answer." }]);
        break;
      }
      if (payload.note) setNote(payload.note);
      if (payload.type === "message") {
        setLines((current) => [...current, { role: "assistant", text: payload.text || "" }]);
        turnsRef.current.push({ role: "assistant", content: payload.text || "" });
        break;
      }
      if (payload.text) {
        setLines((current) => [...current, { role: "assistant", text: payload.text || "" }]);
      }
      for (const step of payload.steps || []) {
        if (stopRef.current) break;
        if (step.needsConfirm) {
          setPending(step);
          setSpotlight({ selector: step.spotlight, caption: step.caption });
          setRunning(false);
          return;
        }
        const ok = await play(step);
        if (!ok) break;
      }
      if (!payload.continue) break;
      extraTurns = undefined;
    }
    setSpotlight(null);
    setRunning(false);
    if (mode === "agent") await saveTour();
  }

  async function send() {
    const text = draft.trim();
    if (!text || running) return;
    setDraft("");
    setTourHref("");
    setNote("");
    promptRef.current = text;
    playedRef.current = [];
    const next = [...turnsRef.current, { role: "user" as const, content: text }];
    turnsRef.current = next;
    setLines((current) => [...current, { role: "user", text }]);
    await run(next);
  }

  const panel = (
    <div className="flex h-full min-h-0 flex-col bg-paper text-ink">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Logo tone="ink" width={28} height={28} className="h-7 w-7" />
        <div className="min-w-0">
          <p className="font-serif text-lg leading-none">Price Ranger</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">Assistant</p>
        </div>
        <button type="button" className="ml-auto text-sm font-semibold text-muted" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 p-3">
        {(["ask", "agent"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={`h-10 rounded-xl text-sm font-semibold ${mode === item ? "bg-pine text-cream" : "bg-cream text-muted"}`}
          >
            {item === "ask" ? "Ask" : "Agent"}
          </button>
        ))}
      </div>
      {note ? <p className="px-4 text-xs leading-relaxed text-muted">{note}</p> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            {mode === "ask"
              ? "Ask about your quotes, prices, and groups. Answers link back to the records."
              : "Agent mode walks the screen while it works. Press Stop any time. Deletes wait for you to confirm."}
          </p>
        ) : (
          lines.map((line, index) => (
            <p
              key={`${line.role}-${index}`}
              className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${line.role === "user" ? "bg-cream" : "bg-[#e7f0ea]"}`}
            >
              {renderText(line.text)}
            </p>
          ))
        )}
        {tourHref ? (
          <Link href={tourHref} className="block text-sm font-semibold text-pine">
            Replay this as a guided tour
          </Link>
        ) : null}
        {pending ? (
          <div className="rounded-2xl border border-line p-3">
            <p className="text-sm leading-relaxed">{pending.caption}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="h-10 rounded-xl bg-pine px-3 text-sm font-semibold text-cream"
                onClick={() => {
                  const step = pending;
                  setPending(null);
                  setRunning(true);
                  void (async () => {
                    await play(step, true);
                    setSpotlight(null);
                    setRunning(false);
                    await saveTour();
                  })();
                }}
              >
                Confirm
              </button>
              <button type="button" className="h-10 rounded-xl px-3 text-sm font-semibold text-muted" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={mode === "ask" ? "Ask about your quotes" : "Tell it what to do"}
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line px-3 text-base outline-none focus:border-pine"
        />
        {running ? (
          <button type="button" onClick={stop} className="h-12 rounded-2xl bg-[#8d3b32] px-4 text-sm font-semibold text-cream">
            Stop
          </button>
        ) : (
          <button className="h-12 rounded-2xl bg-pine px-4 text-sm font-semibold text-cream">Send</button>
        )}
      </form>
    </div>
  );

  return (
    <>
      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,720px)] rounded-t-3xl border border-line shadow-2xl lg:inset-y-0 lg:left-auto lg:right-0 lg:h-dvh lg:w-[400px] lg:rounded-none">
          {panel}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Ask Price Ranger"
          onClick={() => setOpen(true)}
          className="ranger-pulse fixed bottom-24 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-pine shadow-lg lg:bottom-6 lg:right-6"
        >
          <Logo tone="light" width={48} height={48} className="h-12 w-12" />
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gold text-xs font-bold text-pine-deep">
            ✦
          </span>
        </button>
      )}
      {spotlight && (running || pending) ? (
        <Spotlight selector={spotlight.selector} caption={spotlight.caption} onStop={stop} />
      ) : null}
    </>
  );
}
