import { createGroup } from "@/app/actions";
import { BackLink, Button, Notice, TextField } from "@/components/ui";

export const metadata = { title: "New group" };

export default async function NewGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div>
      <BackLink href="/library/groups">Groups</BackLink>
      <h1 className="font-serif text-4xl">New group</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Name it the way you would say it to a customer.
      </p>
      <form action={createGroup} className="mt-6 space-y-4">
        <Notice code={error} />
        <TextField label="Group name" name="name" required placeholder="Bathroom refresh" />
        <Button type="submit">Create group</Button>
      </form>
    </div>
  );
}
