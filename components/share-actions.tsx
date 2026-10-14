"use client";

import { useState } from "react";

import { IconLink, IconShare } from "./icons";

export function ShareActions({ href, title }: { href: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");

  function absolute() {
    return new URL(href, window.location.origin).toString();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absolute());
      setCopied(true);
      setNote("Link copied.");
    } catch {
      setNote("Copy the address from the open link.");
    }
  }

  async function share() {
    const url = absolute();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        setNote("Share sheet opened.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold"
        >
          <IconLink className="h-5 w-5" />
          {copied ? "Copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-pine px-4 text-base font-semibold text-cream"
        >
          <IconShare className="h-5 w-5" />
          Share
        </button>
      </div>
      <p className="min-h-5 text-caption text-muted" role="status">
        {note}
      </p>
    </div>
  );
}
