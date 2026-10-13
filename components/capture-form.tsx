import { startAndPrice } from "@/app/guide-actions";
import { Button } from "@/components/ui";

import { PathSwitch } from "./path-switch";
import { PhotoField } from "./photo-field";
import { PrimaryDock } from "./primary-dock";

export function CaptureForm() {
  return (
    <form action={startAndPrice} className="space-y-4">
      <PathSwitch defaultValue="item" />
      <label className="block text-base font-semibold">
        What is it?
        <textarea
          name="description"
          rows={4}
          placeholder="Oak table, or a small roof"
          className="mt-2 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base font-normal leading-6 outline-none focus:border-pine"
        />
      </label>
      <PhotoField />
      <PrimaryDock>
        <Button type="submit">See price</Button>
      </PrimaryDock>
    </form>
  );
}
