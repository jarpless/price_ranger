import { stripeMode, stripeModeLabel } from "@/lib/billing";

/** Readable mode label. Test mode is an amber badge so it is not mistaken for a live charge. */
export function StripeModeNote() {
  const mode = stripeMode();
  const label = stripeModeLabel();
  if (mode === "test") {
    return (
      <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-[#f4e4c4] px-3 py-1.5 text-sm font-semibold leading-5 text-[#3f2e10]">
        Stripe test mode. No real charges.
      </p>
    );
  }
  if (mode === "live") {
    return (
      <p className="mt-3 inline-flex max-w-full items-center rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold leading-5 text-ink">
        {label}
      </p>
    );
  }
  return <p className="mt-3 text-body leading-6 text-ink">{label}</p>;
}
