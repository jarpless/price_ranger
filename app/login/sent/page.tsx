import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

import { DEV_LINK_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const cookieStore = await cookies();
  const devLink = cookieStore.get(DEV_LINK_COOKIE)?.value;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Image src="/images/logo-mark.png" alt="" width={64} height={64} className="mb-6 h-16 w-16" />
      <h1 className="font-serif text-3xl">Check your email</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        {email
          ? `If ${email} can receive mail, a sign-in link is on its way. It expires in 15 minutes.`
          : "A sign-in link is on its way. It expires in 15 minutes."}
      </p>
      {devLink ? (
        <div className="mt-6 rounded-3xl border border-dashed border-gold bg-paper p-4">
          <p className="text-sm font-semibold text-pine">Local development</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Email is not configured here. Open the sign-in link to finish.
          </p>
          <a
            href={devLink}
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine font-semibold text-cream"
          >
            Open sign-in link
          </a>
        </div>
      ) : null}
      <Link href="/login" className="mt-6 text-center text-sm font-semibold text-pine">
        Use a different email
      </Link>
    </main>
  );
}
