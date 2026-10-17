import { PendingLink as Link } from "@/components/pending-link";
import { LANDING_CATEGORIES, newPriceHref } from "@/lib/landing-categories";

/** Dense category picker for signed-in Home. Self-contained: drop it anywhere in a page column. */
export function HomeCategories({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="home-categories-title" className={`surface ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-categories-title" className="text-base font-semibold">
          Start from an example
        </h2>
        <Link href="/new" prefetch={false} data-home-category="other" className="inline-flex h-11 items-center whitespace-nowrap text-sm font-semibold text-pine">
          Anything else
        </Link>
      </div>
      <ul className="mt-1 divide-y divide-line">
        {LANDING_CATEGORIES.map((category) => (
          <li key={category.id} data-home-category={category.id} className="py-2">
            <p className="text-caption font-semibold text-muted">{category.name}</p>
            <ul className="scroll-x -mx-1 mt-1 flex gap-2 px-1 pb-1 lg:flex-wrap" aria-label={`${category.name} examples`}>
              {category.items.map((item) => (
                <li key={item.label} className="shrink-0">
                  <Link
                    href={newPriceHref(item.query)}
                    prefetch={false}
                    data-home-item={item.label}
                    className="inline-flex h-11 items-center whitespace-nowrap rounded-full border border-line bg-cream px-3.5 text-sm font-semibold text-ink hover:border-pine"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
