export default function GuideLoading() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[40rem] animate-pulse lg:mx-0 lg:max-w-none" aria-busy="true" aria-live="polite">
      <span className="sr-only">Pricing</span>
      <div className="h-2 w-full rounded-full bg-line" />
      <div className="mt-6 h-10 w-48 rounded-2xl bg-line lg:w-64" />
      <div className="mt-3 h-5 w-full max-w-md rounded-xl bg-paper" />
      <div className="content-split">
        <div className="mt-6 space-y-4 rounded-3xl bg-paper p-5">
          <div className="h-12 w-40 rounded-2xl bg-line" />
          <div className="h-4 w-full rounded-xl bg-cream" />
          <div className="h-4 w-2/3 rounded-xl bg-cream" />
          <div className="h-10 w-full rounded-2xl bg-cream" />
        </div>
        <div className="mt-4 lg:mt-6">
          <div className="h-12 w-full rounded-2xl bg-pine/80 lg:w-48" />
        </div>
      </div>
    </div>
  );
}
