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
      <form action={createQuote} className="mt-6 space-y-4">
        <Notice code={error} />
        <TextField label={words.customer} name="customerName" autoComplete="name" required placeholder={words.customerExample} />
        <TextField label={words.job} name="title" required placeholder={words.jobExample} />
        <Button type="submit">Create {words.quote.toLowerCase()}</Button>
      </form>
    </div>
  );
}
