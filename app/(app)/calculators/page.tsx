import { PendingLink as Link } from "@/components/pending-link";

import { Calculator } from "@/components/calculator";

export const metadata = { title: "Calculators" };

export default function CalculatorsPage() {
  return (
    <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <h1 className="font-serif text-display lg:text-[2.5rem] lg:leading-[3rem]">Calculators</h1>
      <p className="mt-2 text-body leading-6 text-muted">
        Try a discount or a fee here. It does not change a saved price.
      </p>
      <div className="mt-6">
        <Calculator />
      </div>
      <Link href="/" className="mt-6 inline-flex h-12 items-center font-semibold text-pine">
        Your prices
      </Link>
    </div>
  );
}
