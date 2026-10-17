import type { QuoteMediaItem } from "./media-file";

export interface CarouselSlide {
  id: string;
  kind: "image" | "video";
  src: string;
  poster: string | null;
  mime: string;
  alt: string;
}

function slides(base: string, title: string, items: QuoteMediaItem[]): CarouselSlide[] {
  const name = title.trim() || "Quote";
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    src: `${base}/${encodeURIComponent(item.id)}`,
    poster: item.poster ? `${base}/${encodeURIComponent(item.id)}?poster=1` : null,
    mime: item.mime,
    alt: item.kind === "video" ? `${name} video` : name,
  }));
}

export function ownerSlides(quoteId: string, title: string, items: QuoteMediaItem[]): CarouselSlide[] {
  return slides(`/quotes/${encodeURIComponent(quoteId)}/media`, title, items);
}

export function publicSlides(token: string, title: string, items: QuoteMediaItem[]): CarouselSlide[] {
  return slides(`/p/${encodeURIComponent(token)}/media`, title, items);
}
