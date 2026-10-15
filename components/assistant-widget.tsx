"use client";

import { PendingLink as Link } from "@/components/pending-link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import {
  ASSISTANT_CHANNEL,
  ASSISTANT_STORAGE_KEY,
  type AskMode,
  type AssistantChrome,
  type AssistantSnapshot,
  type ChatLine,
  type ChatTurn,
  clampDockWidth,
  pickSnapshot,
  readSnapshot,
  writeSnapshot,
} from "@/lib/assistant/presence";

import { inferAssistantMode } from "@/lib/assistant/intent";

import { InfoTip } from "./info-tip";
import { Logo } from "./logo";
import { MyFeedbackList } from "./my-feedback-list";
import { Spotlight } from "./spotlight";

interface Allowance {
  used: number;
  cap: number;
  remaining: number;
}

interface Step {
  name: string;
  args: Record<string, string>;
  caption: string;
  href: string;
  spotlight: string;
  needsConfirm: boolean;
}

type AssistantMessage =
  | { type: "snapshot"; snapshot: AssistantSnapshot; from: string }
  | { type: "ping"; from: string }
  | { type: "popout-closed"; from: string }
  | { type: "reclaim"; from: string }
  | { type: "host-send"; id: string; text: string; mode: AskMode; turns: ChatTurn[]; from: string }
  | { type: "host-ack"; id: string; from: string };

const HOST_KEY = "pr-assistant-host";
const HOST_AT = "pr-assistant-host-at";
const POPOUT_NAME = "pr-assistant";
const MOBILE_QUERY = "(max-width: 63.99rem)";

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

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

function focusable(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.hasAttribute("disabled") && node.tabIndex !== -1,
  );
}

function useMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(MOBILE_QUERY);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export function AssistantWidget({
  signedIn,
  allowance: initialAllowance,
}: {
  stamp: import("@/lib/build-info").BuildStamp;
  signedIn: boolean;
  allowance?: Allowance | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const mobile = useMobile();
  const popout = pathname === "/assistant";
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AskMode>("ask");
  const [chrome, setChrome] = useState<AssistantChrome>("floating");
  const [dockWidth, setDockWidth] = useState(380);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Step | null>(null);
  const [spotlight, setSpotlight] = useState<{ selector: string; caption: string } | null>(null);
  const [tourHref, setTourHref] = useState("");
  const [allowance, setAllowance] = useState<Allowance | null>(initialAllowance ?? null);
  const [popoutAlive, setPopoutAlive] = useState(false);
  const [turnVersion, setTurnVersion] = useState(0);

  const stopRef = useRef(false);
  const turnsRef = useRef<ChatTurn[]>([]);
  const playedRef = useRef<{ caption: string; href: string; spotlight: string }[]>([]);
  const promptRef = useRef("");
  const clientId = useRef(newId());
  const snapRef = useRef<AssistantSnapshot>(readSnapshot());
  const revRef = useRef(0);
  const skipPublish = useRef(true);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const popoutWindowRef = useRef<Window | null>(null);
  const lastPingRef = useRef(0);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const modeRef = useRef<AskMode>("ask");
  const runningRef = useRef(false);
  const popoutRef = useRef(popout);
  const popoutAliveRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const sendRef = useRef<(text?: string, fromHost?: boolean) => Promise<void>>(async () => {});
  const ackWaiters = useRef(new Map<string, () => void>());
  const reclaimedRef = useRef(false);
  const dockWidthRef = useRef(380);

  modeRef.current = mode;
  runningRef.current = running;
  popoutRef.current = popout;
  popoutAliveRef.current = popoutAlive;
  pathnameRef.current = pathname;
  dockWidthRef.current = dockWidth;

  function adopt(snapshot: AssistantSnapshot) {
    const picked = pickSnapshot(snapRef.current, snapshot);
    if (picked.rev <= snapRef.current.rev) return;
    skipPublish.current = true;
    snapRef.current = picked;
    revRef.current = picked.rev;
    turnsRef.current = picked.turns;
    setMode(picked.mode);
    setLines(picked.lines);
    setChrome(picked.chrome);
    setDockWidth(picked.dockWidth);
  }

  function post(message: AssistantMessage) {
    channelRef.current?.postMessage(message);
  }

  function claimHost() {
    try {
      window.localStorage.setItem(HOST_KEY, clientId.current);
      window.localStorage.setItem(HOST_AT, String(Date.now()));
    } catch {
      /* storage can be blocked */
    }
  }

  function isHost() {
    try {
      return window.localStorage.getItem(HOST_KEY) === clientId.current;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!signedIn) return;
    skipPublish.current = true;
    const snap = readSnapshot();
    snapRef.current = snap;
    revRef.current = snap.rev;
    turnsRef.current = snap.turns;
    setMode(snap.mode);
    setLines(snap.lines);
    setChrome(snap.chrome);
    setDockWidth(snap.dockWidth);
    setReady(true);
  }, [signedIn]);

  useEffect(() => {
    if (pathname === "/ask") setOpen(true);
  }, [pathname]);

  useEffect(() => {
    function openAsk() {
      setOpen(true);
    }
    window.addEventListener("pr-ask", openAsk);
    return () => window.removeEventListener("pr-ask", openAsk);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(ASSISTANT_CHANNEL);
    } catch {
      channel = null;
    }
    channelRef.current = channel;

    function onMessage(event: MessageEvent<AssistantMessage>) {
      const message = event.data;
      if (!message || message.from === clientId.current) return;
      if (message.type === "snapshot") {
        adopt(message.snapshot);
        return;
      }
      if (message.type === "ping") {
        lastPingRef.current = Date.now();
        setPopoutAlive(true);
        if (!popoutRef.current) {
          const mine = isHost();
          const at = Number(window.localStorage.getItem(HOST_AT) || 0);
          if (mine || Date.now() - at > 2500) claimHost();
        }
        return;
      }
      if (message.type === "popout-closed") {
        setPopoutAlive(false);
        popoutWindowRef.current = null;
        return;
      }
      if (message.type === "reclaim" && popoutRef.current) {
        reclaimedRef.current = true;
        post({ type: "popout-closed", from: clientId.current });
        window.close();
        setNote("This window can close. The assistant is back in the app.");
        return;
      }
      if (message.type === "host-ack") {
        ackWaiters.current.get(message.id)?.();
        return;
      }
      if (message.type === "host-send" && !popoutRef.current && isHost()) {
        post({ type: "host-ack", id: message.id, from: clientId.current });
        modeRef.current = message.mode === "agent" ? "agent" : "ask";
        setMode(modeRef.current);
        turnsRef.current = Array.isArray(message.turns) ? message.turns : [];
        if (runningRef.current) {
          const hint = "Still working on the last request.";
          turnsRef.current = [
            ...turnsRef.current,
            { role: "user", content: message.text },
            { role: "assistant", content: hint },
          ];
          setLines((current) => [...current, { role: "user", text: message.text }, { role: "assistant", text: hint }]);
          setTurnVersion((value) => value + 1);
          return;
        }
        void sendRef.current(message.text, true);
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== ASSISTANT_STORAGE_KEY || !event.newValue) return;
      try {
        adopt(JSON.parse(event.newValue) as AssistantSnapshot);
      } catch {
        /* ignore malformed snapshots */
      }
    }

    channel?.addEventListener("message", onMessage);
    window.addEventListener("storage", onStorage);
    return () => {
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener("storage", onStorage);
    };
    // adopt and post close over the latest refs; the listener is installed once per sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  useEffect(() => {
    if (!ready) return;
    if (skipPublish.current) {
      skipPublish.current = false;
      return;
    }
    const next = writeSnapshot(snapRef.current, {
      mode,
      lines,
      turns: turnsRef.current,
      chrome,
      dockWidth,
    });
    snapRef.current = next;
    revRef.current = next.rev;
    post({ type: "snapshot", snapshot: next, from: clientId.current });
    // post is stable enough for this publish; including it would resubscribe every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, lines, chrome, dockWidth, turnVersion]);

  useEffect(() => {
    if (!popout || !signedIn) return;
    const ping = () => {
      if (reclaimedRef.current) return;
      post({ type: "ping", from: clientId.current });
    };
    ping();
    const id = window.setInterval(ping, 1000);
    const close = () => post({ type: "popout-closed", from: clientId.current });
    window.addEventListener("pagehide", close);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", close);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popout, signedIn]);

  useEffect(() => {
    if (popout || !signedIn) return;
    const id = window.setInterval(() => {
      setPopoutAlive(Date.now() - lastPingRef.current < 2500);
    }, 500);
    return () => window.clearInterval(id);
  }, [popout, signedIn]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.repeat) return;
      if (event.key.toLowerCase() !== "k" || event.altKey || event.shiftKey) return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (popoutRef.current) return;
      if (pathnameRef.current.startsWith("/p/") || pathnameRef.current.includes("/present")) return;
      event.preventDefault();
      if (popoutAliveRef.current) {
        reclaim();
        return;
      }
      setOpen((value) => !value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panelVisible = popout || open;
  const modal = panelVisible && (popout || mobile || chrome !== "docked");

  useEffect(() => {
    if (!modal) return;
    const panel = panelRef.current;
    if (!panel) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    if (!popout) document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (popoutRef.current) window.close();
        else setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const list = focusable(panel);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (!popout) document.body.style.overflow = previousOverflow;
      if (!popoutRef.current) prior?.focus();
    };
  }, [modal, popout]);

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
    setLines((current) => [...current, { role: "assistant", text: step.caption }]);
    turnsRef.current.push({ role: "assistant", content: step.caption });
    setTurnVersion((value) => value + 1);
    setSpotlight({ selector: step.spotlight, caption: step.caption });
    const href = step.href === "/settings/plans" || step.href.startsWith("/settings/plans/") ? "/upgrade" : step.href;
    if (href.startsWith("/") && !href.startsWith("//")) {
      router.push(href);
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
    setTurnVersion((value) => value + 1);
    const still = await wait(900, () => stopRef.current);
    return still;
  }

  async function run(extraTurns?: ChatTurn[]) {
    if (!signedIn) {
      setLines((current) => [...current, { role: "assistant", text: "Sign in to ask about your quotes." }]);
      return;
    }
    setRunning(true);
    stopRef.current = false;
    let guard = 0;
    while (guard < 6 && !stopRef.current) {
      guard += 1;
      const here = pathnameRef.current;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeRef.current,
          pathname: `${here}${document.querySelector("[data-guide-step]") ? `?step=${document.querySelector("[data-guide-step]")?.getAttribute("data-guide-step")}` : ""}`,
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
        allowance?: Allowance;
      };
      if (!response.ok) {
        setLines((current) => [...current, { role: "assistant", text: payload.error || payload.text || "The assistant could not answer." }]);
        break;
      }
      if (payload.note) setNote(payload.note);
      if (payload.allowance) setAllowance(payload.allowance);
      if (payload.type === "message") {
        setLines((current) => [...current, { role: "assistant", text: payload.text || "" }]);
        turnsRef.current.push({ role: "assistant", content: payload.text || "" });
        break;
      }
      if (payload.text) {
        setLines((current) => [...current, { role: "assistant", text: payload.text || "" }]);
      }
      if (popoutRef.current && (payload.steps || []).length > 0) {
        const text = "Agent steps run in the Price Ranger window. Bring the assistant back to walk the screen.";
        setLines((current) => [...current, { role: "assistant", text }]);
        turnsRef.current.push({ role: "assistant", content: text });
        break;
      }
      for (const step of payload.steps || []) {
        if (stopRef.current) break;
        if (step.needsConfirm) {
          const shown = document.querySelector("[data-spotlight='asking-price']")?.textContent?.trim() || "";
          const caption = shown && step.caption.includes("the price on screen")
            ? step.caption.replace("the price on screen", shown)
            : step.caption;
          setPending({ ...step, caption });
          setSpotlight({ selector: step.spotlight, caption: "" });
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
    if (modeRef.current === "agent") await saveTour();
  }

  function waitForHost(text: string) {
    const id = newId();
    return new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => {
        ackWaiters.current.delete(id);
        resolve(false);
      }, 700);
      ackWaiters.current.set(id, () => {
        window.clearTimeout(timer);
        ackWaiters.current.delete(id);
        resolve(true);
      });
      post({
        type: "host-send",
        id,
        text,
        mode: modeRef.current,
        turns: turnsRef.current,
        from: clientId.current,
      });
    });
  }

  async function send(preset?: string, fromHost = false) {
    const text = (preset ?? draft).trim();
    if (!text || runningRef.current) return;
    if (!fromHost) {
      const chosen = inferAssistantMode(text, pathnameRef.current);
      modeRef.current = chosen;
      setMode(chosen);
      setDraft("");
    }
    if (popoutRef.current && !fromHost) {
      const acked = await waitForHost(text);
      if (acked) return;
      if (modeRef.current === "agent") {
        const hint = "That step needs the Price Ranger window. Bring the assistant back to walk the screen.";
        turnsRef.current = [...turnsRef.current, { role: "user", content: text }, { role: "assistant", content: hint }];
        setLines((current) => [...current, { role: "user", text }, { role: "assistant", text: hint }]);
        setTurnVersion((value) => value + 1);
        return;
      }
    }
    setTourHref("");
    setNote("");
    promptRef.current = text;
    playedRef.current = [];
    const next = [...turnsRef.current, { role: "user" as const, content: text }];
    turnsRef.current = next;
    setLines((current) => [...current, { role: "user", text }]);
    await run(next);
  }

  sendRef.current = send;

  function popOut() {
    const opened = window.open("/assistant", POPOUT_NAME, "popup,width=440,height=760");
    if (!opened) {
      setNote("The browser blocked the new window. Allow pop-ups for this site, then try again.");
      return;
    }
    popoutWindowRef.current = opened;
    lastPingRef.current = Date.now();
    setPopoutAlive(true);
    claimHost();
    setOpen(false);
  }

  function reclaim() {
    const opened = popoutWindowRef.current;
    if (opened && !opened.closed) {
      opened.focus();
      opened.close();
    }
    const next = writeSnapshot(readSnapshot(), { chrome: "floating" });
    skipPublish.current = true;
    snapRef.current = next;
    revRef.current = next.rev;
    turnsRef.current = next.turns;
    setMode(next.mode);
    setLines(next.lines);
    setChrome("floating");
    setDockWidth(next.dockWidth);
    setPopoutAlive(false);
    lastPingRef.current = 0;
    setOpen(true);
    post({ type: "snapshot", snapshot: next, from: clientId.current });
    post({ type: "reclaim", from: clientId.current });
  }

  function onResizeDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startW = dockWidthRef.current;
    function move(ev: PointerEvent) {
      const next = clampDockWidth(startW + (startX - ev.clientX));
      dockWidthRef.current = next;
      setDockWidth(next);
    }
    function up(ev: PointerEvent) {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId);
    }
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  }

  const suppressPill = pathname.startsWith("/signin") || pathname.startsWith("/login") || pathname.startsWith("/settings/delete");
  const laneOff = suppressPill || (!popout && !mobile && chrome === "docked" && panelVisible);
  useEffect(() => {
    if (!signedIn) {
      document.body.dataset.ask = "off";
      return;
    }
    document.body.dataset.ask = laneOff ? "off" : "on";
  }, [signedIn, laneOff]);

  if (!signedIn || pathname.startsWith("/p/") || suppressPill) return null;

  const dockTarget = !popout && !mobile && chrome === "docked" && panelVisible ? document.getElementById("assistant-dock") : null;
  const docked = Boolean(dockTarget);
  const showLauncher = !popout && !docked;
  const launcherLabel = popoutAlive ? "Assistant open in another window, click to bring it back" : "Price Ranger";

  const panel = (
    <div className="flex min-h-0 flex-1 flex-col bg-paper text-ink">
      <div className="border-b border-line">
        <div className="flex items-center gap-2 px-4 py-3">
          <Logo tone="ink" width={28} height={28} className="h-7 w-7" />
          <div className="min-w-0">
            <p className="font-serif text-lg leading-none">Price Ranger</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Assistant</p>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex h-12 items-center whitespace-nowrap px-3 text-base font-semibold text-ink"
            onClick={() => {
              if (popout) window.close();
              else setOpen(false);
            }}
          >
            {popout ? "Close window" : "Close"}
          </button>
        </div>
        {!popout && !mobile ? (
          <div className="flex flex-wrap gap-2 px-4 pb-3">
            <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-ink" onClick={popOut}>
              Open in new window
            </button>
            {chrome === "docked" ? (
              <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-ink" onClick={() => setChrome("floating")}>
                Float
              </button>
            ) : (
              <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm font-semibold text-ink" onClick={() => setChrome("docked")}>
                Open in side panel
              </button>
            )}
          </div>
        ) : null}
      </div>
      {allowance ? (
        <p className="flex items-center px-4 text-caption text-muted">
          {allowance.used} of {allowance.cap} used this month
          <InfoTip id="messages" />
          {allowance.remaining <= 2 ? (
            <Link href="/upgrade" className="ml-2 font-semibold text-pine">
              Upgrade
            </Link>
          ) : null}
        </p>
      ) : null}
      {note ? <p className="px-4 text-xs leading-relaxed text-muted">{note}</p> : null}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {lines.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted">
              Ask about a price, or say what to do. Price Ranger answers, and it walks the screen when you tell it to act. Press Stop any time. Deletes wait for you to confirm.
            </p>
            <MyFeedbackList />
            <div className="flex flex-wrap gap-2">
              {(pathname.startsWith("/guide")
                ? ["What is this worth?", "How do I share this?", "How do I mark it sold?"]
                : ["How do I share a price?", "What plan am I on?", "How do I add a photo?"]
              ).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="h-11 rounded-full border border-line px-3 text-sm font-semibold text-ink"
                  onClick={() => void send(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
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
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask or tell Price Ranger what to do"
          aria-label="Message Price Ranger"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line px-3 text-base outline-none focus:border-pine"
        />
        {running ? (
          <button type="button" onClick={stop} className="h-12 rounded-2xl bg-[#8d3b32] px-4 text-sm font-semibold text-cream">
            Stop
          </button>
        ) : (
          <button className="h-12 whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream">Send</button>
        )}
      </form>
    </div>
  );

  const frame = panelVisible ? (
    <div
      ref={panelRef}
      id="assistant-panel"
      role={modal ? "dialog" : "complementary"}
      aria-modal={modal ? true : undefined}
      aria-label="Price Ranger"
      className={docked ? "ask-dock" : popout ? "ask-popout" : "ask-float"}
      style={docked ? { width: dockWidth } : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && docked) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      {docked ? (
        <button
          type="button"
          className="ask-dock-handle"
          role="separator"
          aria-label="Resize assistant"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={560}
          aria-valuenow={dockWidth}
          onPointerDown={onResizeDown}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setDockWidth((value) => clampDockWidth(value + 16));
            if (event.key === "ArrowRight") setDockWidth((value) => clampDockWidth(value - 16));
          }}
        />
      ) : null}
      {panel}
    </div>
  ) : null;

  return (
    <>
      {showLauncher ? (
        <button
          type="button"
          className="ask-launcher"
          aria-expanded={panelVisible}
          aria-controls={panelVisible ? "assistant-panel" : undefined}
          aria-keyshortcuts="Control+K Meta+K"
          onClick={() => {
            if (popoutAlive) reclaim();
            else setOpen((value) => !value);
          }}
        >
          <span className="ask-launcher-mark">
            <Logo tone="light" width={28} height={28} className="h-6 w-6" alt="" />
          </span>
          <span>{launcherLabel}</span>
        </button>
      ) : null}
      {docked && dockTarget ? createPortal(frame, dockTarget) : frame}
      {!popout && spotlight && (running || pending) ? <Spotlight selector={spotlight.selector} caption={spotlight.caption} onStop={stop} /> : null}
    </>
  );
}
