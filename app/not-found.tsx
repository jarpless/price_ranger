import { PendingLink as Link } from "@/components/pending-link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="font-serif text-4xl">That page is not here</h1>
      <Link href="/" className="mt-4 font-semibold text-pine">
        Back to quotes
      </Link>
    </main>
  );
}
