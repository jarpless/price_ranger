import { createQuote } from "@/app/actions";
import { BackLink, Button, Notice, TextField } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { vocabulary } from "@/lib/vocabulary";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const words = vocabulary((await requireUser()).industry);
  return (
    <div>
      <BackLink href="/quotes">{words.quotes}</BackLink>
      <h1 className="font-serif text-4xl">New {words.quote.toLowerCase()}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Start with the {words.customer.toLowerCase()} and the {words.job.toLowerCase()}. You can add options next.
      </p>
      <form action={createQuote} className="mt-6 space-y-4" data-spotlight="new-quote">
        <Notice code={error} />
        <TextField
          label={words.customer}
          name="customerName"
          autoComplete="name"
          required
          placeholder={words.customerExample}
          data-spotlight="new-quote-customer"
        />
        <TextField label={words.job} name="title" required placeholder={words.jobExample} data-spotlight="new-quote-job" />
        <Button type="submit" data-spotlight="new-quote-create">
          Create {words.quote.toLowerCase()}
        </Button>
      </form>
    </div>
  );
}
