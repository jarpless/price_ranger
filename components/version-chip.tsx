import { stampText, type BuildStamp } from "@/lib/build-info";

export function VersionChip({ stamp }: { stamp: BuildStamp }) {
  return (
    <p className="pointer-events-none fixed bottom-4 left-64 z-10 hidden text-caption text-muted lg:block">
      {stampText(stamp)}
    </p>
  );
}
