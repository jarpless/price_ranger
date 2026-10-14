"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GLOSSARY, type GlossaryId } from "@/lib/glossary";

import { IconInfo } from "./icons";

export function InfoTip({ id, label }: { id: GlossaryId; label?: string }) {
  const tip = GLOSSARY[id];
  const reactId = useId();
  const tipId = `tip-${reactId}`;
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const text = label || `About ${tip.term}`;

  return (
    <span ref={root} className="relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-pine"
        aria-label={text}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          const width = 256;
          const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
          setBox({ top: rect.bottom + 8, left });
          setOpen((value) => !value);
        }}
      >
        <IconInfo className="h-5 w-5" />
        <span className="sr-only">{text}</span>
      </button>
      {open && box
        ? createPortal(
            <span
              id={tipId}
              role="tooltip"
              style={{ top: box.top, left: box.left }}
              className="fixed z-[80] w-64 rounded-2xl border border-line bg-paper p-3 text-left text-caption leading-4 text-ink shadow-sheet"
            >
              <span className="block font-semibold">{tip.term}</span>
              <span className="mt-1 block text-muted">{tip.body}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
