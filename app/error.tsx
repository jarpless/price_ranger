"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Try that again. If it keeps happening, check the setup notes.
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
