"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useActionState } from "react";

import { startAndPrice } from "@/app/guide-actions";
import { CATEGORIES, namesForAutocomplete, QUICK_ITEMS, searchSuggestions } from "@/lib/market";

import { IconCamera } from "./icons";
import { PhotoField } from "./photo-field";
import { PrimaryDock } from "./primary-dock";

export function CaptureForm({ initial = "" }: { initial?: string }) {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [description, setDescription] = useState(initial);
  const [barcode, setBarcode] = useState("");
  const [error, submit, pending] = useActionState(startAndPrice, "");
  const names = useMemo(() => namesForAutocomplete(), []);
  const matches = searchSuggestions(description, names);
  const items = QUICK_ITEMS.filter((item) => !category || item.category === category);
  const guard = useRef(false);

  useEffect(() => {
    if (!pending) guard.current = false;
  }, [pending]);

  async function onBarcode(file: File, form: HTMLFormElement) {
    const Detector = "BarcodeDetector" in window ? window.BarcodeDetector : null;
    if (!Detector) {
      setBarcode("This browser can't read barcodes. Pick the item below.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const codes = await new Detector().detect(bitmap);
      const raw = codes[0]?.rawValue?.trim();
      if (!raw) {
        setBarcode("No barcode in that photo. Pick the item below.");
        return;
      }
      setBarcode(`Barcode ${raw}. If you know the item, tap it.`);
      const named = QUICK_ITEMS.find((item) => raw.toLowerCase().includes(item.label.toLowerCase()));
      if (named) {
        flushSync(() => setDescription(named.description));
        form.requestSubmit();
      }
    } catch {
      setBarcode("We couldn't read that barcode. Pick the item below.");
    }
  }

  return (
    <form
      action={submit}
      className="space-y-5"
      onSubmit={(event) => {
        if (guard.current || pending) {
          event.preventDefault();
          return;
        }
        guard.current = true;
      }}
    >
      <input type="hidden" name="path" value="item" />
      <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
        <p className="font-serif text-title">Take a photo</p>
        <p className="mt-1 text-body text-muted">A clear shot of the item is enough. You don't have to type.</p>
        <div className="mt-4">
          <PhotoField hero />
        </div>
        <label className="mt-3 flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line text-base font-semibold">
          <IconCamera className="h-5 w-5" />
          Scan a barcode
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              const form = event.currentTarget.form;
              if (!file || !form) return;
              void onBarcode(file, form);
            }}
          />
        </label>
        {barcode ? <p className="mt-2 text-caption text-muted">{barcode}</p> : null}
      </div>

      <div>
        <p className="text-caption font-semibold text-muted">Or tap an item</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Category">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(category === item ? null : item)}
              className={`h-11 rounded-full px-4 text-base font-semibold ${category === item ? "bg-pine text-cream" : "border border-line bg-paper text-ink"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.label}
              type="submit"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                const form = event.currentTarget.form;
                flushSync(() => setDescription(item.description));
                form?.requestSubmit();
              }}
              className="h-11 rounded-full border border-line bg-cream px-4 text-base font-semibold text-ink disabled:opacity-60"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block" htmlFor="item-search">
        <span className="mb-1.5 block text-sm font-medium">Search, if it isn't listed</span>
        <input
          id="item-search"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Nintendo Switch, iPhone, bike"
          autoComplete="off"
          role="combobox"
          aria-expanded={matches.length > 0}
          aria-controls="item-suggestions"
          className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base font-normal outline-none focus:border-pine"
        />
      </label>
      {matches.length > 0 ? (
        <ul id="item-suggestions" role="listbox" className="overflow-hidden rounded-2xl border border-line bg-paper">
          {matches.map((name) => (
            <li key={name} role="presentation">
              <button
                type="button"
                role="option"
                className="h-12 w-full px-4 text-left text-base font-normal hover:bg-cream"
                onClick={() => setDescription(name)}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error === "limit" ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">
          You&apos;ve used all your free prices. <a className="font-semibold underline" href="/upgrade">See plans</a> to add more.
        </p>
      ) : error ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">Add a few words, or a photo.</p>
      ) : null}
      <PrimaryDock>
        <button type="submit" disabled={pending} className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-60 lg:w-auto lg:min-w-48 lg:px-6">
          {pending ? "Pricing" : "See price"}
        </button>
      </PrimaryDock>
    </form>
  );
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (): { detect: (source: ImageBitmap) => Promise<{ rawValue?: string }[]> };
    };
  }
}
