"use client";

import { useEffect } from "react";

const KEY = "pr-console-errors";

export function rememberConsoleError(message: string) {
  try {
    const previous = JSON.parse(sessionStorage.getItem(KEY) || "[]") as string[];
    previous.push(message.slice(0, 500));
    sessionStorage.setItem(KEY, JSON.stringify(previous.slice(-20)));
  } catch {
    // sessionStorage can be unavailable.
  }
}

export function readConsoleErrors(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed.map(String).slice(-20) : [];
  } catch {
    return [];
  }
}

export function ConsoleBuffer() {
  useEffect(() => {
    const original = console.error;
    console.error = (...args: unknown[]) => {
      rememberConsoleError(args.map((value) => (value instanceof Error ? value.message : String(value))).join(" "));
      original(...args);
    };
    const onError = (event: ErrorEvent) => rememberConsoleError(event.message || "Script error");
    window.addEventListener("error", onError);
    return () => {
      console.error = original;
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
}
