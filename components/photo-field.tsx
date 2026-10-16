"use client";

import { useState } from "react";

import { priceError } from "@/lib/guide/pricing";

import { vibrate } from "./feel";
import { preparePhoto } from "./prepare-photo";

export function PhotoField({ hero = false }: { hero?: boolean }) {
  const [notice, setNotice] = useState("");

  return (
    <div>
      <label className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-pine font-semibold text-cream ${hero ? "h-16 text-lg" : "h-12 border border-line bg-paper px-4 text-base text-ink"}`}>
        {hero ? "Open camera" : "Add photo"}
        <input
          name="photo"
          type="file"
          accept="image/*"
          capture={hero ? "environment" : undefined}
          className="sr-only"
          onChange={(event) => {
            const input = event.target;
            const file = input.files?.[0];
            const form = input.form;
            if (!file || !form) return;
            vibrate();
            setNotice("");
            void preparePhoto(file).then((prepared) => {
              if ("error" in prepared) {
                input.value = "";
                setNotice(priceError(prepared.error) || "We couldn't read that photo. Add one line, or try a smaller JPEG.");
                return;
              }
              const transfer = new DataTransfer();
              transfer.items.add(prepared.file);
              input.files = transfer.files;
              form.requestSubmit();
            });
          }}
        />
      </label>
      {notice ? <p className="mt-3 rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{notice}</p> : null}
    </div>
  );
}
