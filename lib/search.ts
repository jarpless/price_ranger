import { BRANDS, PRODUCTS, SKUS } from "./catalog";
import type { CatalogHit } from "./types";

export function seededCatalogHits(): CatalogHit[] {
  return SKUS.map((sku) => {
    const product = PRODUCTS.find((item) => item.id === sku.productId);
    const brand = BRANDS.find((item) => item.id === product?.brandId);
    return {
      id: sku.id,
      name: sku.name,
      variation: sku.variation,
      brandName: brand?.name ?? "",
      category: product?.category ?? "",
      unit: sku.unit,
      listPriceCents: sku.listPriceCents,
      connectorSlug: sku.connectorSlug,
      skuCode: sku.skuCode,
    };
  });
}

export function filterCatalog(hits: CatalogHit[], query: string): CatalogHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return hits
    .filter((hit) => {
      const haystack = [hit.name, hit.variation, hit.brandName, hit.category, hit.skuCode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 20);
}
