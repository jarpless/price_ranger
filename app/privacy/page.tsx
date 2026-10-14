import { PendingLink as Link } from "@/components/pending-link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="page-frame page-frame-pad">
      <div className="mx-auto w-full max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-danger">DRAFT – pending legal review</p>
      <h1 className="mt-2 font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed">
        <p>
          We store the account, prices, and outcomes you save so you can come back to them. We do not sell your name,
          email, or the text of your quotes.
        </p>
        <p>
          Anonymized, de-identified pricing and outcome data is used for aggregate benchmarks and insights. That means
          the price, a broad category, and whether it sold. It does not include your name, your customer's name, email,
          phone, address, or the words you typed. We do not publish a benchmark from fewer than five similar prices.
        </p>
        <p>
          You can request deletion of your personal information, or opt out of the sale or sharing of personal
          information, in Settings. This is the control for CCPA. It does not turn off the aggregate use described in
          the Terms, which every account accepts at signup.
        </p>
        <p>This draft is not legal advice and is waiting for review.</p>
      </div>
      <Link href="/welcome" className="mt-8 inline-flex h-12 items-center font-semibold text-pine">
        Back
      </Link>
      </div>
    </main>
  );
}
