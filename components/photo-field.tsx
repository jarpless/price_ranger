"use client";

import { vibrate } from "./feel";

export function PhotoField() {
  return (
    <label className="flex h-12 cursor-pointer items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-ink">
      Add photo
      <input
        name="photo"
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file || !event.target.form) return;
          vibrate();
          event.target.form.requestSubmit();
        }}
      />
    </label>
  );
}
