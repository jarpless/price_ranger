import Image from "next/image";

import { sendMagicLink } from "@/app/actions";
import { Button, Notice, TextField } from "@/components/ui";
import { dataBackend } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const local = dataBackend() === "local";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Image
        src="/images/logo-full.png"
        alt="Price Ranger"
        width={512}
        height={512}
        priority
        className="mx-auto mb-6 h-auto w-48"
      />
      <h1 className="text-center font-serif text-3xl leading-tight">
        Quote the job. Present the options.
      </h1>
      <p className="mt-3 text-center text-base leading-relaxed text-muted">
        A simple way to price home improvement work and show a customer a few clear choices.
      </p>
      <form action={sendMagicLink} className="mt-8 space-y-4">
        <Notice code={error} />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
        <Button type="submit">Email me a sign-in link</Button>
      </form>
      {local ? (
        <p className="mt-6 text-center text-sm leading-relaxed text-muted">
          Local mode: the sign-in link stays on this device. No email is sent.
        </p>
      ) : null}
    </main>
  );
}
