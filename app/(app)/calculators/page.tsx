import { PendingLink as Link } from "@/components/pending-link";

import { Calculator } from "@/components/calculator";

export const metadata = { title: "Calculators" };

export default function CalculatorsPage() {
  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Secondary</p>
      <h1 className="mt-1 font-serif text-5xl">Calculators</h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Try a discount or a fee here. It does not change a saved price.
      </p>
      <div className="mt-6">
        <Calculator />
      </div>
      <Link href="/menu" className="mt-6 inline-flex h-12 items-center font-semibold text-pine">
        Back to the menu
      </Link>
    </div>
  );
}
