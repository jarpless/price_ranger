import { PendingLink as Link } from "@/components/pending-link";

import { TOS_VERSION } from "@/lib/guide/config";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-danger">DRAFT – pending legal review</p>
      <h1 className="mt-2 font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Version {TOS_VERSION}</p>
      <div className="mt-6 space-y-4 text-lg leading-relaxed">
        <p>
          Price Ranger helps you price an item, a job, or a number you want to check, then send that price to someone else.
        </p>
        <p>
          By creating an account you agree that anonymized, de-identified pricing and outcome data is used for aggregate
          benchmarks and insights. Names, emails, phone numbers, and addresses are stripped before anything is counted.
          A benchmark is only shown when at least five similar prices are in the bucket.
        </p>
        <p>
          You can ask us to delete your personal information, or opt out of the sale or sharing of personal information,
          from Settings. Those requests are separate from the aggregate benchmarks described above.
        </p>
        <p>This draft is not legal advice and is waiting for review.</p>
      </div>
      <Link href="/welcome" className="mt-8 inline-flex h-12 items-center font-semibold text-pine">
        Back
      </Link>
    </main>
  );
}
