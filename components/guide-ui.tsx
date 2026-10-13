import { GUIDE_STEPS, stepIndex, type GuideStep } from "@/lib/guide/flow";

const LABELS = ["Add", "Price", "Adjust", "Send", "Sold"];

export function GuideProgress({ step }: { step: GuideStep }) {
  const index = stepIndex(step);
  return (
    <div>
      <p className="text-sm font-semibold text-pine">
        Step {index + 1} of {GUIDE_STEPS.length}
      </p>
      <ol className="mt-2 flex gap-1.5" aria-label="Progress">
        {LABELS.map((label, item) => (
          <li key={label} className="min-w-0 flex-1">
            <div className={`h-2.5 rounded-full ${item <= index ? "bg-pine" : "bg-line"}`} />
            <p className={`mt-1 truncate text-center text-[11px] font-semibold ${item === index ? "text-ink" : "text-muted"}`}>
              {label}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WhereCard({
  did,
  now,
  next,
}: {
  did: string;
  now: string;
  next: string;
}) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-4 text-base leading-relaxed">
      <p>
        <span className="font-semibold">What you did. </span>
        {did}
      </p>
      <p className="mt-2">
        <span className="font-semibold">Where you are. </span>
        {now}
      </p>
      <p className="mt-2">
        <span className="font-semibold">What's next. </span>
        {next}
      </p>
    </section>
  );
}
