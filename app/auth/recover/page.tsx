import { RecoverSession } from "@/components/recover-session";

export const dynamic = "force-dynamic";

export default function RecoverPage() {
  return (
    <main className="page-frame page-frame-pad flex min-h-dvh flex-col justify-center">
      <p className="text-center font-serif text-title">Signing you in…</p>
      <RecoverSession />
    </main>
  );
}
