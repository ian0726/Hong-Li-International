export type ProductSortFields = {
  category: string;
  brand: string;
  model: string;
  year: string;
  sku: string;
};

const collator = new Intl.Collator("zh-TW", {
  numeric: true,
  sensitivity: "base",
});

function normalizeSortValue(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeModel(value: unknown) {
  return normalizeSortValue(value).replace(/\s+/g, "");
}

export function compareProducts(a: ProductSortFields, b: ProductSortFields) {
  return collator.compare(normalizeSortValue(a.category), normalizeSortValue(b.category))
    || collator.compare(normalizeSortValue(a.brand), normalizeSortValue(b.brand))
    || collator.compare(normalizeModel(a.model), normalizeModel(b.model))
    || collator.compare(normalizeSortValue(a.year), normalizeSortValue(b.year))
    || collator.compare(normalizeSortValue(a.sku), normalizeSortValue(b.sku));
}

export function sortProducts<T extends ProductSortFields>(records: T[]) {
  return [...records].sort(compareProducts);
}

export const productOrderBySql = `
  UPPER(TRIM(p.category)) COLLATE NOCASE,
  UPPER(TRIM(p.brand)) COLLATE NOCASE,
  UPPER(REPLACE(TRIM(p.model), ' ', '')) COLLATE NOCASE,
  TRIM(p.year) COLLATE NOCASE,
  TRIM(p.sku) COLLATE NOCASE,
  p.id ASC
`;
