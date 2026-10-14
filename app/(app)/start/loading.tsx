export default function StartLoading() {
  return (
    <main className="page-frame page-frame-pad flex min-h-dvh animate-pulse flex-col lg:justify-center" aria-busy="true">
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
