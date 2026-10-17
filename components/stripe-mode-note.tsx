import { stripeMode, stripeModeLabel } from "@/lib/billing";

/**
 * Test mode is an amber badge so it is not mistaken for a live charge.
 * Live mode shows nothing: paying customers do not need a mode label.
 */
export function StripeModeNote() {
  const mode = stripeMode();
  if (mode === "live") return null;
  if (mode === "test") {
    return (
      <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-[#f4e4c4] px-3 py-1.5 text-sm font-semibold leading-5 text-[#3f2e10]">
        Stripe test mode. No real charges.
      </p>
    );
  }
  return <p className="mt-3 text-body leading-6 text-ink">{stripeModeLabel()}</p>;
}
