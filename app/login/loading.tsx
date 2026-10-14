export default function LoginLoading() {
  return (
    <main className="page-frame page-frame-pad flex min-h-dvh animate-pulse flex-col justify-center" aria-busy="true">
      <div className="mx-auto w-full max-w-lg lg:max-w-xl">
      <div className="mx-auto mb-6 h-24 w-44 rounded-2xl bg-line" />
      <div className="mx-auto h-9 w-64 max-w-full rounded-2xl bg-line" />
      <div className="mx-auto mt-3 h-4 w-80 max-w-full rounded-xl bg-paper" />
      <div className="mt-8 h-12 w-full rounded-2xl bg-paper" />
      <div className="mt-4 h-12 w-full rounded-2xl bg-pine/80" />
      </div>
    </main>
  );
}
