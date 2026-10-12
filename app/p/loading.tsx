export default function PublicSheetLoading() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg animate-pulse px-5 py-10" aria-busy="true">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-line" />
      <div className="mx-auto mt-6 h-8 w-48 rounded-2xl bg-line" />
      <div className="mt-8 space-y-3">
        <div className="h-14 rounded-2xl bg-paper" />
        <div className="h-14 rounded-2xl bg-paper" />
        <div className="h-14 rounded-2xl bg-paper" />
      </div>
    </main>
  );
}
