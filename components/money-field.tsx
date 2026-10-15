"use client";

import { useEffect, useRef, useState } from "react";

import { formatUsd, parseDollarsToCents } from "@/lib/money";

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
  className = "mt-1 h-12 w-full min-w-0 rounded-2xl border border-line px-3 text-base font-normal",
}: {
  name: string;
  defaultValue: string;
  label?: string;
  submitOnBlur?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(() => shownMoney(defaultValue));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(shownMoney(defaultValue));
  }, [defaultValue]);

  const field = (
    <input
      name={name}
      inputMode="decimal"
      value={text}
      onChange={(event) => setText(event.target.value)}
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
      onBlur={(event) => {
        focused.current = false;
        const cents = parseDollarsToCents(text);
        if (cents == null) return;
        const formatted = formatUsd(cents);
        setText(formatted);
        const previous = parseDollarsToCents(defaultValue);
        if (submitOnBlur && cents !== previous) event.currentTarget.form?.requestSubmit();
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
