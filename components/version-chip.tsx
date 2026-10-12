import { stampText, type BuildStamp } from "@/lib/build-info";

export function VersionChip({ stamp }: { stamp: BuildStamp }) {
  return (
    <p className="pointer-events-none fixed inset-x-0 top-1 z-30 flex justify-center lg:top-auto lg:bottom-3">
      <span className="rounded-full bg-gold/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-pine-deep shadow-sm">
        {stampText(stamp)}
      </span>
    </p>
  );
}
