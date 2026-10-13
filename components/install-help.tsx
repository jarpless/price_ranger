"use client";

import { useEffect, useState } from "react";

import { vibrate } from "./feel";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

type BrowserId = "safari-ios" | "chrome-ios" | "chrome-android" | "other";

const STEPS: { id: BrowserId; title: string; body: string }[] = [
  {
    id: "safari-ios",
    title: "iPhone Safari",
    body: "Tap the Share button, then Add to Home Screen.",
  },
  {
    id: "chrome-ios",
    title: "iPhone Chrome",
    body: "Tap the Share icon in the address bar, then Add to Home Screen. Chrome on iPhone uses the same sheet as Safari.",
  },
  {
    id: "chrome-android",
    title: "Android Chrome",
    body: "Tap the menu, then Install app. If Chrome offers a banner, that is the same install.",
  },
];

export function InstallHelp() {
  const [browser, setBrowser] = useState<BrowserId>("other");
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua);
    if (ios && /CriOS/.test(ua)) setBrowser("chrome-ios");
    else if (ios) setBrowser("safari-ios");
    else if (/Android/.test(ua) && /Chrome/.test(ua)) setBrowser("chrome-android");

    function onPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  return (
    <div className="mt-6 space-y-3">
      {promptEvent && !installed ? (
        <button
          type="button"
          data-haptic=""
          onClick={() => {
            vibrate();
            void promptEvent.prompt().then(() => setInstalled(true));
          }}
          className="inline-flex h-12 w-full items-center justify-center whitespace-nowrap rounded-2xl bg-pine text-base font-semibold text-cream lg:w-auto lg:min-w-48 lg:px-6"
        >
          Install
        </button>
      ) : null}
      <ul className="overflow-hidden rounded-2xl border border-line bg-paper shadow-card">
        {STEPS.map((step) => (
          <li key={step.id} className={`border-b border-line px-4 py-4 last:border-b-0 ${browser === step.id ? "bg-[#e7f0ea]" : ""}`}>
            <p className="whitespace-nowrap text-base font-semibold">{step.title}</p>
            <p className="mt-1 text-body leading-6 text-muted">{step.body}</p>
            {browser === step.id ? <p className="mt-2 text-caption font-semibold text-pine">This matches your browser.</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
