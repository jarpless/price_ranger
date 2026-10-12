export default function PlainLoading() {
  return (
    <main className="flex min-h-dvh animate-pulse items-center justify-center bg-pine px-5" aria-busy="true">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-3">
        <div className="h-64 rounded-3xl bg-white/10" />
        <div className="h-64 rounded-3xl bg-white/10" />
        <div className="hidden h-64 rounded-3xl bg-white/10 lg:block" />
      </div>
    </main>
  );
}
