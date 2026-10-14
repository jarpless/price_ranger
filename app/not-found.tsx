import { PendingLink as Link } from "@/components/pending-link";

export default function NotFound() {
  return (
    <main className="page-frame page-frame-pad flex min-h-dvh flex-col justify-center">
      <div className="mx-auto w-full max-w-md">
      <h1 className="font-serif text-4xl">That page is not here</h1>
      <Link href="/" className="mt-4 font-semibold text-pine">
        Back to quotes
      </Link>
      </div>
    </main>
  );
}
