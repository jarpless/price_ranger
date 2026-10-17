import { PendingLink as Link } from "@/components/pending-link";
import { LANDING_CATEGORIES, landingStartHref } from "@/lib/landing-categories";

export function LandingCategories() {
  return (
    <section aria-labelledby="landing-categories-title" className="w-full">
      <h2 id="landing-categories-title" className="font-serif text-title">
        What are you pricing?
      </h2>
      <p className="mt-1 text-body text-muted">Tap one to start. No account needed.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LANDING_CATEGORIES.map((category) => (
          <li key={category.id} data-landing-category={category.id} className="flex flex-col rounded-3xl border border-line bg-paper p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-6 text-ink">{category.name}</h3>
                <p className="text-caption text-muted">{category.who}</p>
              </div>
              <p className="shrink-0 text-right" aria-label={`Example: ${category.sample.item}, ${category.sample.price} ${category.sample.unit}`}>
                <span className="block font-serif text-title leading-7 text-pine tabular-nums">{category.sample.price}</span>
                <span className="block text-caption text-muted">{category.sample.item}</span>
              </p>
            </div>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label={`${category.name} examples`}>
              {category.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={landingStartHref(item.query)}
                    prefetch={false}
                    data-landing-item={item.label}
                    className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line bg-cream px-4 text-sm font-semibold text-ink hover:border-pine"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="flex">
          <Link
            href={landingStartHref("")}
            prefetch={false}
            data-landing-category="other"
            className="flex w-full flex-col justify-center rounded-3xl border border-dashed border-pine/40 p-4 text-left hover:border-pine"
          >
            <span className="text-base font-semibold text-pine">Anything else with a price</span>
            <span className="mt-1 text-caption text-muted">Snap a photo or type a few words.</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
