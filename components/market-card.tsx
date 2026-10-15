import { applyAdjustment } from "@/app/guide-actions";
import { AskingLineTotal, AskingTotal, publishAskingDraft } from "@/components/asking-price";
import { InfoTip } from "@/components/info-tip";
import { MoneyField } from "@/components/money-field";
import { PriceSlider } from "@/components/price-slider";
import { dollarsInputValue, formatUsd } from "@/lib/money";
import {
  comparablesForTitle,
  CONDITIONS,
  conditionLabel,
  marketPrice,
  readMarketMeta,
  type ConditionId,
} from "@/lib/market";

const PRESETS = [
  { value: "off10", label: "-10%" },
  { value: "off20", label: "-20%" },
  { value: "ship8", label: "Ship $8" },
  { value: "ship15", label: "Ship $15" },
  { value: "fee3", label: "Fee $3" },
] as const;

export function MarketCard({
  quoteId,
  description,
  priceCents,
  note,
  sources,
  extras,
  totalCents,
}: {
  quoteId: string;
  description: string;
  priceCents: number | null;
  note: string;
  sources: string[];
  extras: { name: string; detail: string; price: string }[];
  totalCents?: number | null;
}) {
  const meta = readMarketMeta(sources);
  const live = marketPrice(description, {
    condition: meta.condition,
    variantId: meta.variantId,
  });
  const low = meta.lowCents ?? live?.lowCents ?? null;
  const high = meta.highCents ?? live?.highCents ?? null;
  const confidence = meta.confidence ?? live?.confidence ?? (live ? "medium" : "low");
  const condition = (meta.condition || live?.condition || "good") as ConditionId;
  const point = priceCents ?? live?.cents ?? null;
  const headline = totalCents ?? point;
  const extraCents = point != null && headline != null ? headline - point : 0;
  const suggested = meta.suggestedCents ?? live?.cents ?? null;
  const comparables = live?.comparables.length
    ? live.comparables
    : comparablesForTitle(description, point || suggested || 0);

  return (
    <div className="mt-6 min-w-0 max-w-full space-y-4">
      <section className="min-w-0 max-w-full rounded-2xl border border-line bg-paper p-5 shadow-card">
        <div className="flex items-center gap-1">
          <p className="text-caption font-semibold text-muted">
            {live ? conditionLabel(condition) : "Suggested"}
            {live?.variantLabel && !live.ambiguousModel ? ` · ${live.variantLabel}` : ""}
          </p>
          <InfoTip id="condition" />
        </div>
        <p className="mt-2 text-caption font-semibold uppercase tracking-wide text-muted">Total</p>
        <AskingTotal
          itemCents={point}
          extraCents={extraCents}
          lowCents={low}
          highCents={high}
          className="font-serif text-price text-pine tabular-nums lg:text-[3rem] lg:leading-[3.5rem]"
        />
        {low != null && high != null ? (
          <p className="mt-1 flex items-center text-body text-muted">
            <span className="tabular-nums">
              {formatUsd(low)}–{formatUsd(high)}
            </span>
            <InfoTip id="range" />
          </p>
        ) : (
          <p className="mt-2 text-body leading-6">{note}</p>
        )}
        <p className="mt-2 flex items-center text-caption font-semibold capitalize text-pine">
          {confidence} confidence
          <InfoTip id="confidence" />
        </p>
        {meta.overrideCents != null && suggested != null ? (
          <p className="mt-2 text-caption text-muted">Suggested {formatUsd(suggested)} before your edit.</p>
        ) : null}
        {live && low != null ? <p className="mt-3 text-body leading-6">{live.note}</p> : null}
        {extras.length > 0 ? (
          <ul className="mt-4 border-t border-line pt-2">
            {extras.map((line) => (
              <li key={`${line.name}-${line.detail}`} className="line-row">
                <span className="list-copy">
                  <span className="list-title">{line.name}</span>
                  {line.detail ? <span className="text-caption text-muted">{line.detail}</span> : null}
                </span>
                <span className="list-price">{line.price}</span>
              </li>
            ))}
            <li className="line-row">
              <span className="list-title">Total</span>
              <span className="list-price">
                <AskingLineTotal itemCents={point} extraCents={extraCents} />
              </span>
            </li>
          </ul>
        ) : null}
      </section>

      {live ? (
        <section>
          <p className="text-base font-semibold">Condition</p>
          <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-2" role="group" aria-label="Condition">
            {CONDITIONS.map((item) => (
              <form key={item.id} action={applyAdjustment} className="max-w-full">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="kind" value="condition" />
                <input type="hidden" name="value" value={item.id} />
                <button
                  type="submit"
                  aria-pressed={condition === item.id}
                  className={`h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${condition === item.id ? "bg-pine text-cream" : "border border-line bg-paper"}`}
                >
                  {item.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      {live && live.variants.length > 1 ? (
        <section>
          <p className="text-base font-semibold">Model</p>
          <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-2" role="group" aria-label="Model">
            {live.variants.map((item) => (
              <form key={item.id} action={applyAdjustment} className="max-w-full">
                <input type="hidden" name="quoteId" value={quoteId} />
                <input type="hidden" name="kind" value="variant" />
                <input type="hidden" name="value" value={item.id} />
                <button
                  type="submit"
                  aria-pressed={live.variantId === item.id && !live.ambiguousModel}
                  className={`h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold ${live.variantId === item.id && !live.ambiguousModel ? "bg-pine text-cream" : "border border-line bg-paper"}`}
                >
                  {item.label}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="flex items-center gap-1">
          <p className="text-base font-semibold">Adjust</p>
          <InfoTip id="discount" />
          <InfoTip id="fees" label="About fees" />
        </div>
        <div className="mt-2 flex min-w-0 max-w-full flex-wrap gap-2" role="group" aria-label="Price presets">
          {PRESETS.map((preset) => (
            <form key={preset.value} action={applyAdjustment} className="max-w-full">
              <input type="hidden" name="quoteId" value={quoteId} />
              <input type="hidden" name="kind" value="preset" />
              <input type="hidden" name="value" value={preset.value} />
              <button
                type="submit"
                aria-pressed={meta.preset === preset.value}
                className={`h-11 max-w-full whitespace-nowrap rounded-full px-4 text-sm font-semibold ${meta.preset === preset.value ? "bg-pine text-cream" : "border border-line bg-paper"}`}
              >
                {preset.label}
              </button>
            </form>
          ))}
        </div>
        <div className="mt-4">
          <PriceSlider quoteId={quoteId} suggestedCents={suggested ?? point ?? 0} />
        </div>
        <form action={applyAdjustment} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="kind" value="price" />
          <MoneyField key={point ?? "empty"} name="amount" label="Your price" submitOnBlur onDraft={publishAskingDraft} defaultValue={point != null ? dollarsInputValue(point) : ""} />
          <button type="submit" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold">
            Save price
          </button>
        </form>
        <form action={applyAdjustment} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="quoteId" value={quoteId} />
          <input type="hidden" name="kind" value="line" />
          <label className="block min-w-0 flex-1 text-base font-semibold">
            Add a line
            <input name="name" placeholder="Delivery" className="mt-1 h-12 w-full rounded-2xl border border-line px-3 text-base font-normal" />
          </label>
          <MoneyField name="amount" label="Amount" defaultValue="" />
          <button type="submit" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold">
            Add line
          </button>
        </form>
      </section>

      {comparables.length > 0 ? (
        <section>
          <div className="flex items-center gap-1">
            <p className="text-base font-semibold">Comparables</p>
            <InfoTip id="comparables" />
          </div>
          <ul className="page-stack mt-4">
            {comparables.slice(0, 4).map((comp) => (
              <li key={`${comp.title}-${comp.soldAt}`} className="surface flex min-w-0 items-start gap-3">
                {/* Curated sold-search thumbnail, not a product photo. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={comp.thumbnail} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-cream object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-pretty">{comp.title}</p>
                  <p className="text-caption text-muted">
                    {comp.source} · {comp.condition} · {comp.soldAt} · {comp.listed ? "Listed" : "Sold"}
                  </p>
                  <a href={comp.url} target="_blank" rel="noreferrer" className="text-caption font-semibold text-pine">
                    See similar sold listings on {comp.source}
                  </a>
                </div>
                <p className="list-price shrink-0">{formatUsd(comp.priceCents)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
