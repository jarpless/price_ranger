import { Logo } from "@/components/logo";

export const metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-10">
      <Logo tone="ink" width={64} height={64} className="mb-6 h-16 w-16" />
      <h1 className="font-serif text-4xl">Connect Supabase</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Production needs a new Supabase project. Local development runs without one.
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
        <li>Create a Supabase project and run supabase/migrations/20261012000000_init.sql.</li>
        <li>Turn on the email provider and add this site to the redirect allow list.</li>
        <li>
          Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_SITE_URL.
        </li>
      </ol>
      <p className="mt-6 text-sm leading-relaxed text-muted">
        The full checklist is in docs/PLAN.md.
      </p>
    </main>
  );
}
