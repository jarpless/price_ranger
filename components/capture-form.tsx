"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";

import { createPricedDraft, startAndPriceDirect } from "@/app/guide-actions";
import { CAPTURE_STATE_KEY, readCaptureState, withCaptureState } from "@/lib/capture-state";
import { CATEGORIES, namesForAutocomplete, QUICK_ITEMS, searchSuggestions } from "@/lib/market-shared";

import { IconCamera } from "./icons";
import { AddContextLink } from "./add-context-link";
import { PhotoField } from "./photo-field";
import { PrimaryDock } from "./primary-dock";

const SESSION_KEY = "pr-new-capture";
let restoredFromBack = false;

if (typeof window !== "undefined") {
  const flag = window as Window & { __prCaptureBack?: boolean };
  if (!flag.__prCaptureBack) {
    flag.__prCaptureBack = true;
    window.addEventListener(
      "popstate",
      () => {
        restoredFromBack = true;
      },
      true,
    );
  }
}

function isCategory(value: string | null): value is (typeof CATEGORIES)[number] {
  return CATEGORIES.some((item) => item === value);
}

function persistCapture(description: string, category: string | null) {
  const capture = { description: description.slice(0, 280), category };
  try {
    const current = window.history.state;
    // Keep Next's history marker. Replacing a bare state makes browser Back stay on the quote.
    if (current && typeof current === "object" && "__NA" in current) {
      window.history.replaceState(withCaptureState(current, capture), "");
    }
  } catch {
    /* Private mode can reject history updates. The session copy still restores Back. */
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(capture));
  } catch {
    /* Ignore. */
  }
}

function savedCapture() {
  const fromHistory = readCaptureState(window.history.state);
  if (fromHistory) return fromHistory;
  if (!restoredFromBack) return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return readCaptureState(raw ? { [CAPTURE_STATE_KEY]: JSON.parse(raw) } : null);
  } catch {
    return null;
  }
}

export function CaptureForm({
  initial = "",
  initialCategory = null,
}: {
  initial?: string;
  initialCategory?: string | null;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | null>(isCategory(initialCategory) ? initialCategory : null);
  const [description, setDescription] = useState(initial);
  const [barcode, setBarcode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const names = useMemo(() => namesForAutocomplete(), []);
  const matches = searchSuggestions(description, names);
  const items = QUICK_ITEMS.filter((item) => !category || item.category === category);
  const guard = useRef(false);

  useLayoutEffect(() => {
    const saved = savedCapture();
    restoredFromBack = false;
    if (!saved) return;
    if (!initial && saved.description) setDescription(saved.description);
    if (!initialCategory && isCategory(saved.category)) setCategory(saved.category);
  }, [initial, initialCategory]);

  useEffect(() => {
    if (!pending) guard.current = false;
  }, [pending]);

  async function priceFrom(form: HTMLFormElement) {
    if (guard.current || pending) return;
    guard.current = true;
    setPending(true);
    setError("");
    persistCapture(description, category);
    try {
      const result = await createPricedDraft(new FormData(form));
      if (!result.ok && result.error === "limit") {
        router.push("/upgrade");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        guard.current = false;
        return;
      }
      router.push(result.href);
    } catch (error) {
      const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
      if (digest.includes("NEXT_REDIRECT")) throw error;
      setError("missing");
      setPending(false);
      guard.current = false;
    }
  }

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
      action={startAndPriceDirect}
      className="space-y-5"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void priceFrom(event.currentTarget);
      }}
    >
      <input type="hidden" name="path" value="item" />
      <input type="hidden" name="category" value={category || ""} />
      <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
        <p className="font-serif text-title">Add a photo</p>
        <p className="mt-1 text-body text-muted">A clear shot of the item is enough. Or add a file, notes, or a call.</p>
        <div className="mt-4 flex gap-2">
          <div className="min-w-0 flex-1">
            <PhotoField hero />
          </div>
          <div className="min-w-0 flex-1">
            <AddContextLink />
          </div>
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
              onClick={() => {
                const next = category === item ? null : item;
                setCategory(next);
                persistCapture(description, next);
              }}
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
                persistCapture(item.description, category);
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
          onChange={(event) => {
            const next = event.target.value;
            setDescription(next);
            persistCapture(next, category);
          }}
          placeholder="Game console, dresser, road bike"
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
                onClick={() => {
                  setDescription(name);
                  persistCapture(name, category);
                }}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
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
