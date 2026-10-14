"use client";

import { useRef } from "react";

export function OtpInput({ name = "code" }: { name?: string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function digits() {
    return refs.current.map((input) => input?.value || "").join("");
  }

  function fill(value: string) {
    const clean = value.replace(/\D/g, "").slice(0, 6);
    for (let index = 0; index < 6; index += 1) {
      const input = refs.current[index];
      if (input) input.value = clean[index] || "";
    }
    const hidden = refs.current[0]?.form?.elements.namedItem(name);
    if (hidden instanceof HTMLInputElement) hidden.value = clean;
    if (clean.length === 6) refs.current[0]?.form?.requestSubmit();
    else refs.current[Math.min(clean.length, 5)]?.focus();
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">6-digit code</legend>
      <input type="hidden" name={name} defaultValue="" />
      <div className="grid w-full grid-cols-6 gap-2" role="group" aria-label="6-digit code">
        {Array.from({ length: 6 }, (_, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Digit ${index + 1}`}
            maxLength={index === 0 ? 6 : 1}
            className="h-14 w-full min-w-0 rounded-2xl border border-line bg-paper text-center font-serif text-title outline-none focus:border-pine"
            onChange={(event) => {
              const value = event.target.value;
              if (value.length > 1) {
                fill(value);
                return;
              }
              const clean = value.replace(/\D/g, "").slice(-1);
              event.target.value = clean;
              const hidden = event.currentTarget.form?.elements.namedItem(name);
              if (hidden instanceof HTMLInputElement) hidden.value = digits();
              if (clean && index < 5) refs.current[index + 1]?.focus();
              if (digits().length === 6) event.currentTarget.form?.requestSubmit();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !event.currentTarget.value && index > 0) {
                refs.current[index - 1]?.focus();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              fill(event.clipboardData.getData("text"));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
