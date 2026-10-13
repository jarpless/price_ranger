import { stepIndex, type GuideStep } from "@/lib/guide/flow";

const PHASES = ["Add", "Price", "Send"] as const;

function phaseIndex(step: GuideStep): number {
  const index = stepIndex(step);
  if (index >= 3) return 2;
  if (index >= 1) return 1;
  return 0;
}

export function GuideProgress({ step }: { step: GuideStep }) {
  const current = phaseIndex(step);
  return (
    <ol className="flex gap-2" aria-label="Progress">
      {(step === "sold" ? (["Add", "Price", "Done"] as const) : PHASES).map((label, item) => (
        <li key={label} className="min-w-0 flex-1">
          <div className={`h-1 rounded-full ${item <= current ? "bg-pine" : "bg-line"}`} />
          <p className={`mt-2 whitespace-nowrap text-center text-caption font-semibold ${item === current ? "text-ink" : "text-muted"}`}>
            {label}
          </p>
        </li>
      ))}
    </ol>
  );
}
