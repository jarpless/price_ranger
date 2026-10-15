"use client";

import { useEffect, useRef, useState } from "react";

import { dollarsInputValue, formatUsd, parseDollarsToCents } from "@/lib/money";

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
  const hidden = useRef<HTMLInputElement>(null);
  const held = useRef<number | null>(null);
  const sent = useRef<number | null>(null);
  textRef.current = text;

  useEffect(() => {
    if (focused.current) return;
    const incoming = parseDollarsToCents(defaultValue);
    if (held.current != null && incoming !== held.current) return;
    held.current = null;
    sent.current = null;
    const shown = shownMoney(defaultValue);
    setText(shown);
    textRef.current = shown;
    if (hidden.current && incoming != null) hidden.current.value = dollarsInputValue(incoming);
  }, [defaultValue]);

  function remember(raw: string) {
    textRef.current = raw;
    const cents = parseDollarsToCents(raw);
    if (hidden.current) hidden.current.value = cents == null ? "" : dollarsInputValue(cents);
    onDraft?.(cents);
    return cents;
  }

  function commit(form: HTMLFormElement | null) {
    const cents = remember(textRef.current);
    if (cents == null) return;
    const formatted = formatUsd(cents);
    textRef.current = formatted;
    setText(formatted);
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
    <>
      <input
        inputMode="decimal"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          sent.current = null;
          setText(next);
          remember(next);
        }}
        onPointerDown={(event) => {
          const input = event.currentTarget;
          if (document.activeElement === input) return;
          event.preventDefault();
          input.focus();
          input.select();
        }}
        onMouseUp={(event) => {
          if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) event.preventDefault();
        }}
        onFocus={(event) => {
          focused.current = true;
          event.currentTarget.select();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") commit(event.currentTarget.form);
        }}
        onBlur={(event) => {
          focused.current = false;
          commit(event.currentTarget.form);
        }}
        className={className}
      />
      <input type="hidden" name={name} ref={hidden} defaultValue={(() => {
        const cents = parseDollarsToCents(defaultValue);
        return cents == null ? "" : dollarsInputValue(cents);
      })()} />
    </>
  );
  if (!label) return field;
  return (
    <label className="block min-w-0 flex-1 text-base font-semibold">
      {label}
      {field}
    </label>
  );
}
