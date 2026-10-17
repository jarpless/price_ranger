"use client";

import { useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import { useRouter } from "next/navigation";

import { saveContextDraft } from "@/app/context-actions";
import { asSingleItem, draftId, draftTotalCents, type ContextDraft, type DraftLine, type DraftSection } from "@/lib/context/draft";
import { CONTEXT_ACCEPT, CONTEXT_LIMITS, contextFileProblem, contextKind, type ContextKind } from "@/lib/context/kinds";
import { dollarsInputValue, formatUsd, parseDollarsToCents, parseQuantity } from "@/lib/money";
import type { Unit } from "@/lib/types";
import { UNIT_OPTIONS } from "@/lib/units";

import { vibrate } from "./feel";
import { preparePhoto } from "./prepare-photo";
import { PrimaryDock } from "./primary-dock";

const STORE_KEY = "pr-context-draft";

interface Picked {
  id: string;
  file: File;
  kind: ContextKind;
}

interface Review {
  draft: ContextDraft;
  skipped: string[];
  notice: string;
  prices: Record<string, string>;
  quantities: Record<string, string>;
  itemPrice: string;
  edited: string[];
}

function svg(props: SVGProps<SVGSVGElement>) {
  return { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props };
}

function IconFile(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function IconPhoto(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m20 16-4.5-4.5L7 19" />
    </svg>
  );
}

function IconTable(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16M4 14.5h16M10 5v14" />
    </svg>
  );
}

function IconWave(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 11v2" />
    </svg>
  );
}

function IconLock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svg(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function KindIcon({ kind, className }: { kind: ContextKind; className?: string }) {
  if (kind === "image") return <IconPhoto className={className} />;
  if (kind === "sheet" || kind === "csv") return <IconTable className={className} />;
  if (kind === "transcript") return <IconWave className={className} />;
  return <IconFile className={className} />;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function reviewFrom(draft: ContextDraft, skipped: string[], notice: string): Review {
  const prices: Record<string, string> = {};
  const quantities: Record<string, string> = {};
  for (const section of draft.sections) {
    for (const line of section.lines) {
      prices[line.id] = line.unitPriceCents == null ? "" : dollarsInputValue(line.unitPriceCents);
      quantities[line.id] = String(line.quantity);
    }
  }
  const single = asSingleItem(draft).sections[0].lines[0];
  return { draft, skipped, notice, prices, quantities, itemPrice: single.unitPriceCents ? dollarsInputValue(single.unitPriceCents) : "", edited: [] };
}

const STEPS = ["Reading what you added", "Finding items, amounts and prices", "Building your draft"];

export function ContextComposer() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>([]);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState(0);
  const [review, setReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCanPaste(typeof navigator !== "undefined" && Boolean(navigator.clipboard?.readText));
    try {
      const raw = sessionStorage.getItem(STORE_KEY);
      if (raw) setReview(JSON.parse(raw) as Review);
    } catch {
      /* A bad copy just starts fresh. */
    }
  }, []);

  useEffect(() => {
    try {
      if (review) sessionStorage.setItem(STORE_KEY, JSON.stringify(review));
      else sessionStorage.removeItem(STORE_KEY);
    } catch {
      /* Private mode. */
    }
  }, [review]);

  useEffect(() => {
    if (!pending) return;
    setStep(0);
    const timer = window.setInterval(() => setStep((current) => Math.min(STEPS.length - 1, current + 1)), 1800);
    return () => window.clearInterval(timer);
  }, [pending]);

  const totalBytes = picked.reduce((sum, item) => sum + item.file.size, 0);
  const ready = (picked.length > 0 || text.trim().length > 0) && !pending;

  async function addFiles(list: FileList | File[]) {
    setProblem("");
    const incoming = [...list];
    const next: Picked[] = [];
    const problems: string[] = [];
    for (const original of incoming) {
      if (picked.length + next.length >= CONTEXT_LIMITS.files) {
        problems.push(`Up to ${CONTEXT_LIMITS.files} files at a time.`);
        break;
      }
      let file = original;
      const kind = contextKind(file.name, file.type);
      if (kind === "image") {
        const prepared = await preparePhoto(file);
        if ("error" in prepared) {
          problems.push(`${file.name}: ${prepared.error === "large" ? "this photo is too large." : "we couldn't read this photo. Try a JPEG."}`);
          continue;
        }
        file = new File([prepared.file], file.name.replace(/\.(heic|heif|png|webp|gif)$/i, ".jpg"), { type: prepared.file.type });
      }
      const issue = contextFileProblem(file.name, file.type, file.size);
      if (issue) {
        problems.push(issue);
        continue;
      }
      next.push({ id: draftId("f"), file, kind });
    }
    const combined = [...picked, ...next];
    if (combined.reduce((sum, item) => sum + item.file.size, 0) > CONTEXT_LIMITS.totalBytes) {
      problems.push("That's over 4 MB in total. Remove a file or use a smaller one.");
    } else if (next.length) {
      vibrate();
      setPicked(combined);
    }
    if (problems.length) setProblem(problems.join(" "));
  }

  async function pasteClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText((current) => (current ? `${current}\n${clip}` : clip).slice(0, CONTEXT_LIMITS.pastedChars));
    } catch {
      setProblem("Your browser blocked paste. Long-press the box and choose Paste.");
    }
  }

  async function build() {
    if (!ready) return;
    setPending(true);
    setProblem("");
    const body = new FormData();
    if (text.trim()) body.set("text", text.trim());
    for (const item of picked) body.append("file", item.file, item.file.name);
    try {
      const response = await fetch("/api/context/extract", { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { draft?: ContextDraft; skipped?: string[]; notice?: string; error?: string; message?: string };
      if (response.status === 402) {
        router.push("/upgrade");
        return;
      }
      if (!response.ok || !payload.draft) {
        setProblem(payload.message || "We couldn't read that. Try again, or paste the text instead.");
        setPending(false);
        return;
      }
      vibrate();
      setReview(reviewFrom(payload.draft, payload.skipped || [], payload.notice || ""));
      setPending(false);
      window.scrollTo({ top: 0 });
    } catch {
      setProblem("You look offline. Check your connection and try again.");
      setPending(false);
    }
  }

  if (review) {
    return (
      <ReviewDraft
        review={review}
        onChange={setReview}
        saving={saving}
        error={saveError}
        onStartOver={() => {
          setReview(null);
          setSaveError("");
        }}
        onSave={async (draft) => {
          setSaving(true);
          setSaveError("");
          try {
            const result = await saveContextDraft(JSON.stringify(draft));
            if (!result.ok) {
              setSaveError(result.error);
              setSaving(false);
              return;
            }
            try {
              sessionStorage.removeItem(STORE_KEY);
            } catch {
              /* Ignore. */
            }
            router.push(result.href);
          } catch {
            setSaveError("save");
            setSaving(false);
          }
        }}
      />
    );
  }

  if (pending) {
    return (
      <div className="rounded-3xl border border-line bg-paper p-5 shadow-card" role="status" aria-live="polite">
        <p className="font-serif text-title">Building your price</p>
        <ol className="mt-4 space-y-3">
          {STEPS.map((label, index) => (
            <li key={label} className={`flex items-center gap-3 text-body ${index <= step ? "text-ink" : "text-muted/60"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-caption font-semibold ${index < step ? "bg-pine text-cream" : index === step ? "animate-pulse bg-gold/30 text-pine" : "bg-cream text-muted"}`}>
                {index < step ? "✓" : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-caption text-muted">Nothing is saved until you check it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-3xl border-2 border-dashed p-4 transition-colors ${dragging ? "border-pine bg-pine/5" : "border-line bg-paper"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-pine text-lg font-semibold text-cream active:scale-[0.99]"
        >
          <IconPlus className="h-6 w-6" />
          Choose files
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={CONTEXT_ACCEPT}
          className="sr-only"
          aria-label="Choose files"
          onChange={(event) => {
            const files = event.target.files;
            if (files?.length) void addFiles(files);
            event.target.value = "";
          }}
        />
        <p className="mt-3 text-center text-caption text-muted">
          Photos, PDF, Excel, CSV, Word, or a call transcript.<span className="hidden lg:inline"> Or drop them here.</span>
        </p>
        {picked.length ? (
          <ul className="mt-4 space-y-2" aria-label="Files to read">
            {picked.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-line bg-cream/60 py-2 pl-3 pr-1">
                <KindIcon kind={item.kind} className="h-5 w-5 shrink-0 text-pine" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{item.file.name}</span>
                  <span className="block text-caption text-muted">{sizeLabel(item.file.size)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.file.name}`}
                  onClick={() => setPicked((current) => current.filter((entry) => entry.id !== item.id))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper"
                >
                  <IconClose className="h-5 w-5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="context-text" className="text-base font-semibold">
            Paste text
          </label>
          {canPaste ? (
            <button type="button" onClick={() => void pasteClipboard()} className="h-9 rounded-full border border-line px-4 text-caption font-semibold text-pine">
              Paste
            </button>
          ) : null}
        </div>
        <textarea
          id="context-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, CONTEXT_LIMITS.pastedChars))}
          rows={5}
          placeholder={"A listing, an estimate, your notes, or a call transcript.\n\ne.g. 2 x ceiling fans @ $150, 6 hours labor at $75"}
          className="mt-2 w-full resize-y rounded-2xl border border-line bg-cream/40 px-4 py-3 text-base outline-none placeholder:text-muted/70 focus:border-pine"
        />
      </div>

      <p className="flex items-start gap-2 px-1 text-caption text-muted">
        <IconLock className="mt-px h-4 w-4 shrink-0" />
        <span>
          Private. Files are read once to build this draft, then thrown away. They aren&apos;t saved or shared. Up to {CONTEXT_LIMITS.files} files, 4 MB in total.
        </span>
      </p>

      {problem ? <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">{problem}</p> : null}

      <PrimaryDock>
        <button
          type="button"
          disabled={!ready}
          onClick={() => void build()}
          className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-50 lg:w-auto lg:min-w-48 lg:px-6"
        >
          {picked.length || text.trim() ? "Build price" : "Add a file or text"}
        </button>
        {totalBytes > 0 ? <p className="mt-2 text-center text-caption text-muted lg:text-left">{sizeLabel(totalBytes)} of 4 MB</p> : null}
      </PrimaryDock>
    </div>
  );
}

function SourceChip({ line, edited }: { line: DraftLine; edited: boolean }) {
  const badge = edited
    ? { label: "Edited", className: "bg-cream text-ink" }
    : line.priceFrom === "context"
      ? { label: "From your file", className: "bg-pine/10 text-pine" }
      : line.priceFrom === "estimate"
        ? { label: "Estimate · check it", className: "bg-gold/25 text-[#6b5320]" }
        : { label: "No price yet", className: "bg-[#f8e8e4] text-danger" };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-1 text-caption font-semibold ${badge.className}`}>{badge.label}</span>
      {line.source ? (
        line.evidence ? (
          <details className="min-w-0 text-caption text-muted">
            <summary className="cursor-pointer list-none truncate underline decoration-line underline-offset-2">{line.source}</summary>
            <blockquote className="mt-1 rounded-xl border-l-2 border-pine/40 bg-cream/60 px-3 py-2 text-ink">&ldquo;{line.evidence}&rdquo;</blockquote>
          </details>
        ) : (
          <span className="truncate text-caption text-muted">{line.source}</span>
        )
      ) : null}
    </div>
  );
}

const SAVE_ERRORS: Record<string, string> = {
  limit: "You've used all your free prices.",
  price: "Add a price before you save.",
  empty: "Add at least one line before you save.",
  save: "We couldn't save that. Try again.",
};

function ReviewDraft({
  review,
  onChange,
  onSave,
  onStartOver,
  saving,
  error,
}: {
  review: Review;
  onChange: (next: Review) => void;
  onSave: (draft: ContextDraft) => void;
  onStartOver: () => void;
  saving: boolean;
  error: string;
}) {
  const { draft } = review;
  const lines = draft.sections.flatMap((section) => section.lines);
  const unpriced = lines.filter((line) => !parseDollarsToCents(review.prices[line.id] || "")).length;
  const estimates = lines.filter((line) => line.priceFrom === "estimate" && !review.edited.includes(line.id)).length;

  const current = useMemo<ContextDraft>(() => {
    const sections = draft.sections.map((section) => ({
      ...section,
      lines: section.lines.map((line) => ({
        ...line,
        unitPriceCents: parseDollarsToCents(review.prices[line.id] || ""),
        quantity: parseQuantity(review.quantities[line.id] || "") ?? line.quantity,
      })),
    }));
    return { ...draft, sections };
  }, [draft, review.prices, review.quantities]);
  const total = draftTotalCents(current);

  function setDraft(patch: Partial<ContextDraft>) {
    onChange({ ...review, draft: { ...draft, ...patch } });
  }

  function setSections(sections: DraftSection[]) {
    setDraft({ sections });
  }

  function patchLine(sectionId: string, lineId: string, patch: Partial<DraftLine>) {
    setSections(draft.sections.map((section) => (section.id === sectionId ? { ...section, lines: section.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)) } : section)));
  }

  function markEdited(lineId: string) {
    return review.edited.includes(lineId) ? review.edited : [...review.edited, lineId];
  }

  function addLine(sectionId: string) {
    const line: DraftLine = { id: draftId("l"), name: "", quantity: 1, unit: "each", unitPriceCents: null, priceFrom: "none", source: "Added by you", evidence: "" };
    onChange({
      ...review,
      draft: { ...draft, sections: draft.sections.map((section) => (section.id === sectionId ? { ...section, lines: [...section.lines, line] } : section)) },
      quantities: { ...review.quantities, [line.id]: "1" },
      prices: { ...review.prices, [line.id]: "" },
      edited: [...review.edited, line.id],
    });
  }

  function save() {
    if (draft.format === "item") {
      const single = asSingleItem(current);
      const cents = parseDollarsToCents(review.itemPrice);
      single.sections[0].lines[0] = { ...single.sections[0].lines[0], name: draft.title, unitPriceCents: cents };
      onSave(single);
      return;
    }
    onSave({ ...current, sections: current.sections.map((section) => ({ ...section, lines: section.lines.filter((line) => line.name.trim()) })) });
  }

  const itemCents = parseDollarsToCents(review.itemPrice);
  const canSave = !saving && (draft.format === "item" ? Boolean(itemCents && draft.title.trim()) : lines.some((line) => line.name.trim()));

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-pine/10 px-2.5 py-1 text-caption font-semibold text-pine">{draft.method === "ai" ? "Built by AI" : "Read from your text"}</span>
          <span className="text-caption text-muted">Check it before you save</span>
        </div>
        {draft.summary ? <p className="mt-3 text-body">{draft.summary}</p> : null}
        {draft.sources.length ? <p className="mt-1 truncate text-caption text-muted">Sources: {draft.sources.join(", ")}</p> : null}
        {review.notice || review.skipped.length || draft.missing.length ? (
          <ul className="mt-3 space-y-1.5 rounded-2xl bg-gold/15 px-4 py-3 text-caption text-[#5a4518]">
            {[review.notice, ...review.skipped, ...draft.missing].filter(Boolean).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-cream p-1" role="radiogroup" aria-label="Price format">
        {(
          [
            ["item", "One item"],
            ["job", "Line items"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={draft.format === value}
            onClick={() => {
              if (value === "item" && draft.format !== "item") {
                onChange({ ...review, draft: { ...draft, format: "item" }, itemPrice: total ? dollarsInputValue(total) : review.itemPrice });
              } else setDraft({ format: value });
            }}
            className={`h-11 rounded-xl text-base font-semibold ${draft.format === value ? "bg-paper text-ink shadow-card" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">{draft.format === "item" ? "What it is" : "Job"}</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ title: event.target.value.slice(0, 80) })}
          className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
        />
      </label>

      {draft.format === "item" ? (
        <div className="rounded-3xl border border-line bg-paper p-4 shadow-card">
          <label className="block">
            <span className="text-sm font-medium">Price</span>
            <span className="mt-1.5 flex h-16 items-center rounded-2xl border border-line bg-cream/40 px-4 focus-within:border-pine">
              <span className="text-price font-semibold text-muted">$</span>
              <input
                inputMode="decimal"
                value={review.itemPrice}
                placeholder="0"
                onChange={(event) => onChange({ ...review, itemPrice: event.target.value.replace(/[^\d.]/g, "").slice(0, 12) })}
                className="min-w-0 flex-1 bg-transparent pl-1 text-price font-semibold outline-none"
                aria-label="Price in dollars"
              />
            </span>
          </label>
          {draft.lowCents && draft.highCents ? (
            <p className="mt-3 text-body text-muted">
              Fair range <span className="font-semibold text-ink">{formatUsd(draft.lowCents)}–{formatUsd(draft.highCents)}</span>
              {draft.confidence !== "high" ? <span> · {draft.confidence} confidence</span> : null}
            </p>
          ) : null}
          {lines.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-caption font-semibold text-pine">What we read ({lines.length})</summary>
              <ul className="mt-2 space-y-2">
                {lines.map((line) => (
                  <li key={line.id} className="rounded-2xl bg-cream/60 px-3 py-2">
                    <p className="text-base">
                      {line.quantity !== 1 ? `${line.quantity} × ` : ""}
                      {line.name}
                      {line.unitPriceCents != null ? ` · ${formatUsd(line.unitPriceCents)}` : ""}
                    </p>
                    <div className="mt-1">
                      <SourceChip line={line} edited={false} />
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Customer</span>
            <input
              value={draft.customerName}
              placeholder="Optional"
              autoComplete="off"
              onChange={(event) => setDraft({ customerName: event.target.value.slice(0, 80) })}
              className="h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base outline-none focus:border-pine"
            />
          </label>
          {draft.sections.map((section) => (
            <section key={section.id} className="rounded-3xl border border-line bg-paper p-3 shadow-card" aria-label={section.name}>
              <div className="flex items-center gap-2 px-1">
                <input
                  value={section.name}
                  onChange={(event) => setSections(draft.sections.map((entry) => (entry.id === section.id ? { ...entry, name: event.target.value.slice(0, 80) } : entry)))}
                  className="h-10 min-w-0 flex-1 rounded-xl bg-transparent px-1 font-serif text-title outline-none focus:bg-cream/60"
                  aria-label="Section name"
                />
                {draft.sections.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove section ${section.name}`}
                    onClick={() => setSections(draft.sections.filter((entry) => entry.id !== section.id))}
                    className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-cream"
                  >
                    <IconClose className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              <ul className="mt-2 space-y-2">
                {section.lines.map((line) => {
                  const unitCents = parseDollarsToCents(review.prices[line.id] || "");
                  const qty = parseQuantity(review.quantities[line.id] || "") ?? line.quantity;
                  return (
                    <li key={line.id} className="rounded-2xl border border-line bg-cream/30 p-3">
                      <div className="flex items-start gap-2">
                        <input
                          value={line.name}
                          placeholder="Line item"
                          onChange={(event) => patchLine(section.id, line.id, { name: event.target.value.slice(0, 120) })}
                          className="h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-base font-medium outline-none focus:border-line focus:bg-paper"
                          aria-label="Line item name"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${line.name || "line"}`}
                          onClick={() => setSections(draft.sections.map((entry) => (entry.id === section.id ? { ...entry, lines: entry.lines.filter((item) => item.id !== line.id) } : entry)))}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper"
                        >
                          <IconClose className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[4.5rem_6.5rem_minmax(0,1fr)] gap-2">
                        <input
                          inputMode="decimal"
                          value={review.quantities[line.id] ?? String(line.quantity)}
                          onChange={(event) => onChange({ ...review, quantities: { ...review.quantities, [line.id]: event.target.value.replace(/[^\d.]/g, "").slice(0, 8) }, edited: markEdited(line.id) })}
                          className="h-11 min-w-0 rounded-xl border border-line bg-paper px-3 text-center text-base outline-none focus:border-pine"
                          aria-label="Quantity"
                        />
                        <select
                          value={line.unit}
                          onChange={(event) => patchLine(section.id, line.id, { unit: event.target.value as Unit })}
                          className="h-11 min-w-0 rounded-xl border border-line bg-paper px-2 text-base outline-none focus:border-pine"
                          aria-label="Unit"
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <span className={`flex h-11 min-w-0 items-center rounded-xl border bg-paper px-3 focus-within:border-pine ${unitCents == null ? "border-danger/40" : "border-line"}`}>
                          <span className="text-muted">$</span>
                          <input
                            inputMode="decimal"
                            value={review.prices[line.id] ?? ""}
                            placeholder="Price"
                            onChange={(event) => onChange({ ...review, prices: { ...review.prices, [line.id]: event.target.value.replace(/[^\d.]/g, "").slice(0, 12) }, edited: markEdited(line.id) })}
                            className="min-w-0 flex-1 bg-transparent pl-1 text-base outline-none"
                            aria-label="Unit price in dollars"
                          />
                        </span>
                      </div>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <SourceChip line={line} edited={review.edited.includes(line.id)} />
                        <span className="shrink-0 pt-1 text-base font-semibold tabular-nums">{unitCents != null ? formatUsd(Math.round(unitCents * qty)) : "—"}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={() => addLine(section.id)} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-pine hover:bg-cream/60">
                <IconPlus className="h-5 w-5" />
                Add line
              </button>
            </section>
          ))}
          <button
            type="button"
            onClick={() => setSections([...draft.sections, { id: draftId("s"), name: "New section", lines: [] }])}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-base font-semibold text-muted"
          >
            <IconPlus className="h-5 w-5" />
            Add section
          </button>
          <div className="rounded-3xl bg-pine p-4 text-cream">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold">Total</span>
              <span className="text-price font-semibold tabular-nums">{formatUsd(total)}</span>
            </div>
            {draft.statedTotalCents != null && Math.abs(draft.statedTotalCents - total) > 100 ? (
              <p className="mt-1 text-caption text-cream/80">Your file says {formatUsd(draft.statedTotalCents)}. Tax or fees may not be lines here.</p>
            ) : null}
            {unpriced || estimates ? (
              <p className="mt-1 text-caption text-cream/80">
                {[unpriced ? `${unpriced} without a price` : "", estimates ? `${estimates} estimated` : ""].filter(Boolean).join(" · ")}. You can change any line later.
              </p>
            ) : null}
          </div>
        </>
      )}

      {error ? (
        <p className="rounded-2xl bg-[#f8e8e4] px-4 py-3 text-body text-danger">
          {SAVE_ERRORS[error] || SAVE_ERRORS.save}
          {error === "limit" ? (
            <>
              {" "}
              <a className="font-semibold underline" href="/upgrade">
                See plans
              </a>
            </>
          ) : null}
        </p>
      ) : null}

      <PrimaryDock>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <button
            type="button"
            disabled={!canSave}
            onClick={save}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-pine text-base font-semibold text-cream disabled:opacity-50 lg:w-auto lg:min-w-48 lg:px-6"
          >
            {saving ? "Saving" : draft.format === "item" ? "Save price" : "Save quote"}
          </button>
          <button type="button" onClick={onStartOver} disabled={saving} className="h-11 rounded-2xl px-4 text-base font-semibold text-muted">
            Start over
          </button>
        </div>
      </PrimaryDock>
    </div>
  );
}
