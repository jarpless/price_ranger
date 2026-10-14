"use client";

/** Select the current amount on focus so the next digits replace it. */
export function MoneyField({
  name,
  defaultValue,
  label,
  className = "mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal",
}: {
  name: string;
  defaultValue: string;
  label?: string;
  className?: string;
}) {
  const field = (
    <input
      name={name}
      inputMode="decimal"
      defaultValue={defaultValue}
      onPointerDown={(event) => {
        const input = event.currentTarget;
        if (document.activeElement === input) return;
        // Stop the tap from dropping a caret, which makes the next digits append.
        event.preventDefault();
        input.focus();
        input.select();
      }}
      onFocus={(event) => event.currentTarget.select()}
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
