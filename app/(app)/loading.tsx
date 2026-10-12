export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-10 w-40 rounded-2xl bg-line lg:w-56" />
      <div className="h-12 w-full rounded-2xl bg-paper lg:max-w-xl" />
      <div className="h-12 w-full rounded-2xl bg-pine/80 lg:w-48" />
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <div className="h-36 rounded-3xl bg-paper" />
        <div className="h-36 rounded-3xl bg-paper" />
        <div className="hidden h-36 rounded-3xl bg-paper xl:block" />
      </div>
    </div>
  );
}
