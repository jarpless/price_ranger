"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

import { chatTitle, readChats, upsertChat, writeChats, type SavedChat } from "@/lib/assistant/history";
import { coachPage, COACH_DISMISS_KEY, dismissPage, PAGE_TIPS, parseDismissed, type CoachPage } from "@/lib/assistant/coach";
import { readDesktopPanel, writeDesktopPanel } from "@/lib/assistant/panel";
import { parseTourMemory, rememberTour, shouldAutoStart, tourSteps, TOUR_MEMORY_KEY, type TourMemory } from "@/lib/assistant/tours";
import { inferAssistantMode } from "@/lib/assistant/intent";
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

import { AssistantChat } from "./assistant-chat";
import { Logo } from "./logo";
import { PageTour } from "./page-tour";
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
  choices?: { label: string; args: Record<string, string> }[];
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
  const linesRef = useRef<ChatLine[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Step | null>(null);
  const [spotlight, setSpotlight] = useState<{ selector: string; caption: string } | null>(null);
  const [tourHref, setTourHref] = useState("");
  const [allowance, setAllowance] = useState<Allowance | null>(initialAllowance ?? null);
  const [popoutAlive, setPopoutAlive] = useState(false);
  const [turnVersion, setTurnVersion] = useState(0);
  const [chatId, setChatId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const [guideStep, setGuideStep] = useState<string | null>(null);
  const [dismissedTips, setDismissedTips] = useState<CoachPage[]>([]);
  const [tourMemory, setTourMemory] = useState<TourMemory>({});
  const [coachReady, setCoachReady] = useState(false);
  const [tourOn, setTourOn] = useState(false);
  const tourBoot = useRef("");

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatIdRef = useRef("");
  const modeRef = useRef<AskMode>("ask");
  const runningRef = useRef(false);
  const popoutRef = useRef(popout);
  const popoutAliveRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const sendRef = useRef<(text?: string, fromHost?: boolean) => Promise<void>>(async () => {});
  const ackWaiters = useRef(new Map<string, () => void>());
  const reclaimedRef = useRef(false);
  const dockWidthRef = useRef(380);
  const chromeRef = useRef<AssistantChrome>("floating");
  const wasMobile = useRef<boolean | null>(null);
  const panelHydrated = useRef(false);
  const suspendWrite = useRef(true);
  const skipOpenOnce = useRef(false);

  modeRef.current = mode;
  chromeRef.current = chrome;
  chatIdRef.current = chatId;
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
    chatIdRef.current = picked.chatId;
    setChatId(picked.chatId);
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
    const id = snap.chatId || (snap.lines.length > 0 ? newId() : "");
    chatIdRef.current = id;
    setChatId(id);
    if (snap.lines.length > 0 && id) {
      const saved = upsertChat(readChats(), {
        id,
        title: chatTitle(snap.lines),
        updatedAt: new Date().toISOString(),
        lines: snap.lines,
        turns: snap.turns,
        mode: snap.mode,
      });
      writeChats(saved);
      setChats(saved);
    } else {
      setChats(readChats());
    }
    const desktop = window.matchMedia("(min-width: 64rem)").matches;
    wasMobile.current = !desktop;
    if (desktop) {
      const pref = readDesktopPanel();
      suspendWrite.current = true;
      panelHydrated.current = true;
      setChrome(pref.chrome);
      setOpen(pref.open || pathnameRef.current === "/ask");
    }
    setReady(true);
  }, [signedIn]);

  useEffect(() => {
    if (pathname === "/ask") setOpen(true);
  }, [pathname]);

  useEffect(() => {
    const read = () => document.querySelector("[data-guide-step]")?.getAttribute("data-guide-step") ?? null;
    setGuideStep(read());
    if (!pathname.startsWith("/guide/")) return;
    const id = window.setInterval(() => {
      const next = read();
      setGuideStep((current) => (current === next ? current : next));
    }, 500);
    return () => window.clearInterval(id);
  }, [pathname]);

  useEffect(() => {
    try {
      setDismissedTips(parseDismissed(window.localStorage.getItem(COACH_DISMISS_KEY)));
      setTourMemory(parseTourMemory(window.localStorage.getItem(TOUR_MEMORY_KEY)));
    } catch {
      setDismissedTips([]);
      setTourMemory({});
    }
    setCoachReady(true);
  }, []);

  useEffect(() => {
    if (!coachReady || !ready) return;
    const page = coachPage(pathname, guideStep);
    if (!page) {
      tourBoot.current = "";
      setTourOn(false);
      return;
    }
    if (tourBoot.current === page) return;
    tourBoot.current = page;
    setTourOn(shouldAutoStart(tourMemory, page));
  }, [coachReady, ready, pathname, guideStep, tourMemory]);

  useEffect(() => {
    if (!ready) return;
    const prev = wasMobile.current;
    wasMobile.current = mobile;
    if (prev === null || prev === mobile) return;
    if (mobile) {
      if (chromeRef.current === "docked") setOpen(false);
      return;
    }
    const pref = readDesktopPanel();
    suspendWrite.current = true;
    panelHydrated.current = true;
    setChrome(pref.chrome);
    setOpen(pref.open);
  }, [ready, mobile]);

  useEffect(() => {
    if (!ready || mobile || !panelHydrated.current) return;
    if (suspendWrite.current) {
      suspendWrite.current = false;
      return;
    }
    const saved = readDesktopPanel();
    const rememberOpen = skipOpenOnce.current ? saved.open : open;
    skipOpenOnce.current = false;
    writeDesktopPanel({
      open: rememberOpen,
      chrome: chrome === "floating" ? "floating" : "docked",
    });
  }, [ready, mobile, open, chrome]);

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
          currentChatId();
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
    linesRef.current = lines;
    if (skipPublish.current) {
      skipPublish.current = false;
      return;
    }
    const id = chatIdRef.current;
    const next = writeSnapshot(snapRef.current, {
      mode,
      lines,
      turns: turnsRef.current,
      chrome,
      dockWidth,
      chatId: id,
    });
    snapRef.current = next;
    revRef.current = next.rev;
    post({ type: "snapshot", snapshot: next, from: clientId.current });
    if (lines.length > 0 && id) {
      const saved = upsertChat(readChats(), {
        id,
        title: chatTitle(lines),
        updatedAt: new Date().toISOString(),
        lines,
        turns: turnsRef.current,
        mode,
      });
      writeChats(saved);
      setChats(saved);
    }
    // post is stable enough for this publish; including it would resubscribe every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, mode, lines, chrome, dockWidth, turnVersion, chatId]);

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
      const key = typeof event.key === "string" ? event.key.toLowerCase() : "";
      if (key !== "k" || event.altKey || event.shiftKey) return;
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

  const panelVisible = popout || (ready && open);
  const modal = panelVisible && (popout || mobile || chrome !== "docked");

  useEffect(() => {
    if (!modal) return;
    const panel = panelRef.current;
    if (!panel) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!mobile) inputRef.current?.focus();
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
  }, [modal, popout, mobile]);

  useEffect(() => {
    if (!panelVisible || !mobile) return;
    const frame = panelRef.current;
    const viewport = window.visualViewport;
    if (!frame || !viewport) return;
    function place() {
      if (!frame || !viewport) return;
      const keyboard = window.innerHeight - viewport.height - viewport.offsetTop > 80;
      frame.style.top = `${viewport.offsetTop}px`;
      frame.style.height = `${viewport.height}px`;
      frame.dataset.keyboard = keyboard ? "open" : "closed";
    }
    place();
    viewport.addEventListener("resize", place);
    viewport.addEventListener("scroll", place);
    return () => {
      viewport.removeEventListener("resize", place);
      viewport.removeEventListener("scroll", place);
      frame.style.top = "";
      frame.style.height = "";
      delete frame.dataset.keyboard;
    };
  }, [panelVisible, mobile]);

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

  function rememberLines(next: ChatLine[]) {
    linesRef.current = next;
    setLines(next);
    const snap = writeSnapshot(snapRef.current, {
      mode: modeRef.current,
      lines: next,
      turns: turnsRef.current,
      chatId: chatIdRef.current,
    });
    snapRef.current = snap;
    revRef.current = snap.rev;
  }

  async function play(step: Step, confirmed = false, onSettled?: () => void) {
    rememberLines([...linesRef.current, { role: "assistant", text: step.caption, kind: "step" }]);
    turnsRef.current.push({ role: "assistant", content: step.caption });
    setTurnVersion((value) => value + 1);
    setSpotlight({ selector: step.spotlight, caption: step.caption });
    const href = step.href === "/settings/plans" || step.href.startsWith("/settings/plans/") ? "/upgrade" : step.href;
    if (href.startsWith("/") && !href.startsWith("//")) {
      router.push(href);
    }
    const stayed = await wait(700, () => stopRef.current);
    if (!stayed) return false;
    if (step.name === "navigate" && !confirmed) {
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
      allowance?: Allowance;
    };
    if (effect.allowance) setAllowance(effect.allowance);
    if (!response.ok || effect.ok === false) {
      setLines((current) => [...current, { role: "assistant", text: effect.error || effect.summary || "That step did not run." }]);
      onSettled?.();
      return false;
    }
    if (confirmed && effect.summary) {
      const summary = effect.summary;
      turnsRef.current.push({ role: "assistant", content: summary });
      rememberLines([...linesRef.current, { role: "assistant", text: summary }]);
      setTurnVersion((value) => value + 1);
    }
    // The reply is on screen. The highlight can finish without keeping Stop in the composer.
    onSettled?.();
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
    let holdSpotlight = false;
    try {
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
      if (payload.text && !(payload.steps || []).some((step) => step.caption === payload.text)) {
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
          holdSpotlight = true;
          setRunning(false);
          return;
        }
        const ok = await play(step);
        if (!ok) break;
      }
      if (!payload.continue) break;
      extraTurns = undefined;
    }
    } finally {
      if (!holdSpotlight) setSpotlight(null);
      setRunning(false);
    }
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

  function currentChatId() {
    if (chatIdRef.current) return chatIdRef.current;
    const id = newId();
    chatIdRef.current = id;
    setChatId(id);
    return id;
  }

  async function send(preset?: string, fromHost = false) {
    const text = (preset ?? draft).trim();
    if (!text || runningRef.current) return;
    currentChatId();
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
    const opened = window.open("/assistant", POPOUT_NAME, "popup,width=880,height=900");
    if (!opened) {
      setNote("The browser blocked the new window. Allow pop-ups for this site, then try again.");
      return;
    }
    popoutWindowRef.current = opened;
    lastPingRef.current = Date.now();
    setPopoutAlive(true);
    claimHost();
    skipOpenOnce.current = true;
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
    chatIdRef.current = next.chatId;
    setChatId(next.chatId);
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

  function newChat() {
    const id = newId();
    chatIdRef.current = id;
    turnsRef.current = [];
    playedRef.current = [];
    setChatId(id);
    setLines([]);
    setMode("ask");
    setDraft("");
    setPending(null);
    setNote("");
    setTourHref("");
    setSpotlight(null);
    setHistoryOpen(false);
    setTurnVersion((value) => value + 1);
  }

  function openSaved(id: string) {
    const chat = readChats().find((item) => item.id === id);
    if (!chat) return;
    chatIdRef.current = chat.id;
    turnsRef.current = chat.turns;
    setChatId(chat.id);
    setLines(chat.lines);
    setMode(chat.mode);
    setDraft("");
    setPending(null);
    setNote("");
    setSpotlight(null);
    setHistoryOpen(false);
    setTurnVersion((value) => value + 1);
  }

  function dismissCoach() {
    const page = coachPage(pathnameRef.current, guideStep);
    if (!page) return;
    const next = dismissPage(dismissedTips, page);
    setDismissedTips(next);
    try {
      window.localStorage.setItem(COACH_DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* storage can be blocked */
    }
  }

  function startTour() {
    const page = coachPage(pathnameRef.current, guideStep);
    if (!page) return;
    tourBoot.current = page;
    setTourOn(true);
  }

  function finishTour(reason: "done" | "skipped") {
    const page = coachPage(pathnameRef.current, guideStep);
    if (page) {
      const next = rememberTour(tourMemory, page, reason);
      setTourMemory(next);
      try {
        window.localStorage.setItem(TOUR_MEMORY_KEY, JSON.stringify(next));
      } catch {
        /* storage can be blocked */
      }
    }
    setTourOn(false);
  }

  function tourNote(text: string) {
    if (!open && !popoutRef.current) return;
    currentChatId();
    turnsRef.current = [...turnsRef.current, { role: "assistant", content: text }];
    rememberLines([...linesRef.current, { role: "assistant", text }]);
    setTurnVersion((value) => value + 1);
  }

  function confirmPending(extra?: Record<string, string>) {
    if (!pending) return;
    const picked = pending.choices?.find((choice) =>
      Object.entries(choice.args).every(([key, value]) => extra?.[key] === value),
    );
    const step = {
      ...pending,
      caption: picked?.label || pending.caption,
      args: { ...pending.args, ...extra },
    };
    setPending(null);
    setRunning(true);
    void (async () => {
      try {
        await play(step, true, () => setRunning(false));
      } finally {
        setSpotlight(null);
        setRunning(false);
      }
      await saveTour();
    })();
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

  const coachId = coachPage(pathname, guideStep);
  const showTour = coachReady && tourOn && Boolean(coachId) && !spotlight && !popout;
  const coach =
    coachReady && coachId && !showTour
      ? {
          title: PAGE_TIPS[coachId].title,
          body: PAGE_TIPS[coachId].body,
          dismissed: dismissedTips.includes(coachId),
          replayLabel: tourMemory[coachId] ? "Replay tour" : "Show me",
        }
      : null;

  const dockTarget = !popout && !mobile && chrome === "docked" && panelVisible ? document.getElementById("assistant-dock") : null;
  const docked = Boolean(dockTarget);
  const showLauncher = ready && !popout && !panelVisible;
  const launcherLabel = popoutAlive ? "Assistant open in another window, click to bring it back" : "Price Ranger";

  const panel = (
    <AssistantChat
      mobile={mobile}
      popout={popout}
      docked={docked}
      chatId={chatId}
      lines={lines}
      draft={draft}
      running={running}
      pending={pending}
      allowance={allowance}
      note={note}
      tourHref={tourHref}
      pathname={pathname}
      historyOpen={historyOpen}
      chats={chats}
      composerRef={inputRef}
      onDraft={setDraft}
      onSend={(text) => void send(text)}
      onStop={stop}
      onClose={() => {
        if (popout) window.close();
        else setOpen(false);
      }}
      onNewChat={newChat}
      onToggleHistory={() => setHistoryOpen((value) => !value)}
      onOpenChat={openSaved}
      onConfirm={confirmPending}
      onCancel={() => {
        const text = "Okay. I left that as it is.";
        turnsRef.current.push({ role: "assistant", content: text });
        rememberLines([...linesRef.current, { role: "assistant", text }]);
        setTurnVersion((value) => value + 1);
        setPending(null);
        setSpotlight(null);
      }}
      onRetry={(text) => void send(text)}
      onPopOut={popOut}
      onDock={() => setChrome("docked")}
      onFloat={() => setChrome("floating")}
      coach={coach}
      onDismissCoach={dismissCoach}
      onStartTour={startTour}
    />
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
      {showTour && coachId ? (
        <PageTour key={`${coachId}-${mobile ? "phone" : "desk"}`} steps={tourSteps(coachId, !mobile)} onFinish={finishTour} onNote={tourNote} />
      ) : null}
    </>
  );
}
