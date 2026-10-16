"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { editingMoney, formatUsd, parseDollarsToCents, replacedMoney } from "@/lib/money";

function shownMoney(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cents = parseDollarsToCents(trimmed);
  if (cents == null) return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
  return formatUsd(cents);
}

/** Raw digits while typing. The dollar format is applied when the field blurs. */
export function MoneyField({
  name,
  defaultValue,
  label,
  submitOnBlur = false,
  onDraft,
  className = "mt-1 h-12 w-full min-w-0 rounded-2xl border border-line px-3 text-base font-normal",
}: {
  name: string;
  defaultValue: string;
  label?: string;
  submitOnBlur?: boolean;
  /** Fires with the typed cents while the field changes, before Save. */
  onDraft?: (cents: number | null) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => shownMoney(defaultValue));
  const focused = useRef(false);
  const textRef = useRef(text);
  const sent = useRef<number | null>(null);
  const held = useRef<number | null>(null);
  const fresh = useRef(false);
  const replace = useRef(false);
  const selectNext = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  textRef.current = text;

  useLayoutEffect(() => {
    if (!selectNext.current) return;
    selectNext.current = false;
    inputRef.current?.select();
  }, [text]);

  useEffect(() => {
    if (focused.current) return;
    const incoming = parseDollarsToCents(defaultValue);
    if (held.current != null && incoming !== held.current) return;
    held.current = null;
    sent.current = null;
    const shown = shownMoney(defaultValue);
    setText(shown);
    textRef.current = shown;
  }, [defaultValue]);

  function showRaw(input: HTMLInputElement) {
    const raw = editingMoney(textRef.current);
    replace.current = true;
    selectNext.current = true;
    textRef.current = raw;
    setText(raw);
    input.value = raw;
  }

  function commit(form: HTMLFormElement | null) {
    const cents = parseDollarsToCents(textRef.current);
    if (cents == null) return;
    const formatted = formatUsd(cents);
    textRef.current = formatted;
    setText(formatted);
    onDraft?.(cents);
    if (!submitOnBlur || !form || sent.current === cents) return;
    const previous = parseDollarsToCents(defaultValue);
    if (cents === previous) return;
    sent.current = cents;
    held.current = cents;
    // Tab cancels a submit that starts in the same blur turn. Commit on the next turn.
    window.setTimeout(() => {
      if (form.isConnected) form.requestSubmit();
    }, 0);
  }

  const field = (
    <input
      ref={inputRef}
      name={name}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        const next = replacedMoney(textRef.current, event.target.value, replace.current);
        replace.current = next.armed;
        sent.current = null;
        textRef.current = next.text;
        setText(next.text);
        onDraft?.(parseDollarsToCents(next.text));
      }}
      onPointerDown={(event) => {
        const input = event.currentTarget;
        if (document.activeElement === input) return;
        showRaw(input);
        fresh.current = true;
        event.preventDefault();
        input.focus();
      }}
      onMouseUp={(event) => {
        if (!fresh.current) return;
        event.preventDefault();
        event.currentTarget.select();
        fresh.current = false;
      }}
      onFocus={(event) => {
        focused.current = true;
        showRaw(event.currentTarget);
      }}
      onKeyDown={(event) => {
        if (event.key === "Tab") commit(event.currentTarget.form);
      }}
      onBlur={(event) => {
        focused.current = false;
        replace.current = false;
        commit(event.currentTarget.form);
      }}
      className={className}
    />
  );
  if (!label) return field;
  return (
    <label className="block min-w-0 flex-1 text-base font-semibold">
      {label}
      {field}
    </label>
  );
}
