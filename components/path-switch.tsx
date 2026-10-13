const OPTIONS = [
  { value: "item", label: "Item" },
  { value: "job", label: "Job" },
  { value: "check", label: "Check" },
];

export function PathSwitch({ defaultValue = "item" }: { defaultValue?: string }) {
  return (
    <fieldset>
      <legend className="sr-only">What are you pricing?</legend>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-line p-1">
        {OPTIONS.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              name="path"
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="peer sr-only"
            />
            <span className="flex h-12 items-center justify-center whitespace-nowrap rounded-xl text-base font-semibold text-muted peer-checked:bg-paper peer-checked:text-ink peer-checked:shadow-card">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
