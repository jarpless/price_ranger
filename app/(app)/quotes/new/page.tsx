import { createQuote } from "@/app/actions";
import { BackLink, Button, Notice, TextField } from "@/components/ui";

export const metadata = { title: "New quote" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <BackLink href="/">Quotes</BackLink>
      <h1 className="font-serif text-4xl">New quote</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Start with the customer and the job. You can add options next.
      </p>
      <form action={createQuote} className="mt-6 space-y-4">
        <Notice code={error} />
        <TextField label="Customer" name="customerName" autoComplete="name" required placeholder="Maria Alvarez" />
        <TextField label="Job" name="title" required placeholder="Roof replacement" />
        <Button type="submit">Create quote</Button>
      </form>
    </div>
  );
}
