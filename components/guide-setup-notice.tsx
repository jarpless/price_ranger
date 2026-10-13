import { guideStorageReady } from "@/lib/guide/store";

export function GuideSetupNotice() {
  if (guideStorageReady()) return null;
  return (
    <p className="mb-4 rounded-2xl border border-line bg-paper px-4 py-3 text-body leading-6">
      The guide tables are not on this database yet. You can keep looking around. A new price will not be saved until those migrations are applied.
    </p>
  );
}
