"use client";

import { useRef } from "react";

import { formatUsd, parseDollarsToCents } from "@/lib/money";

function shownMoney(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cents = parseDollarsToCents(trimmed);
  if (cents == null) return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
  return formatUsd(cents);
}

/** Select the current amount on focus so the next digits replace it. */
export function MoneyField({
  name,
  defaultValue,
  label,
  submitOnBlur = false,
  className = "mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal",
}: {
  name: string;
  defaultValue: string;
  label?: string;
  submitOnBlur?: boolean;
  className?: string;
}) {
  const replaceNext = useRef(true);
  const field = (
    <input
      name={name}
      inputMode="decimal"
      defaultValue={shownMoney(defaultValue)}
      onPointerDown={(event) => {
        const input = event.currentTarget;
        if (document.activeElement === input) return;
        event.preventDefault();
        input.focus();
        input.select();
      }}
      onMouseUp={(event) => event.preventDefault()}
      onFocus={(event) => {
        replaceNext.current = true;
        const input = event.currentTarget;
        input.select();
        requestAnimationFrame(() => input.select());
      }}
      onBlur={(event) => {
        replaceNext.current = true;
        const input = event.currentTarget;
        const cents = parseDollarsToCents(input.value);
        if (cents == null) return;
        input.value = formatUsd(cents);
        const previous = parseDollarsToCents(defaultValue);
        if (submitOnBlur && cents !== previous) input.form?.requestSubmit();
      }}
      onBeforeInput={(event) => {
        const input = event.currentTarget;
        if (!replaceNext.current) return;
        replaceNext.current = false;
        if (input.selectionStart === input.selectionEnd) input.select();
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
