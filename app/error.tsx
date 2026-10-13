"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-3 text-body leading-6 text-muted">
        You&apos;re offline, or this page didn&apos;t load. Try again when you have a connection.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-2xl bg-pine font-semibold text-cream"
      >
        Try again
      </button>
    </main>
  );
}
