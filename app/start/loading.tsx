export default function StartLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl animate-pulse flex-col px-5 py-8 lg:justify-center lg:py-12" aria-busy="true">
      <div className="h-12 w-12 rounded-2xl bg-line" />
      <div className="mt-6 h-12 w-72 max-w-full rounded-2xl bg-line" />
      <div className="mt-3 h-5 w-full max-w-xl rounded-xl bg-paper" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="h-32 rounded-3xl bg-paper" />
        <div className="h-32 rounded-3xl bg-paper" />
        <div className="h-32 rounded-3xl bg-paper" />
        <div className="h-32 rounded-3xl bg-paper" />
      </div>
    </main>
  );
}
