import type { Product, Category, Provider, PriceSetting, Stock } from "@prisma/client";

export type ProductWithRelations = Product & {
  category: Category;
  provider: Provider;
  stock: Stock | null;
};

export function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function priceFromPercentage(cost: number, percentage: number) {
  return roundMoney(cost * (1 + percentage / 100));
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function withPrices(product: ProductWithRelations, settings: PriceSetting) {
  const cost = toNumber(product.costPrice);
  return {
    id: product.id,
    code: product.code,
    description: product.description,
    unitMeasure: product.unitMeasure,
    notes: product.notes,
    active: product.active,
    category: product.category.name,
    provider: product.provider.name,
    categoryId: product.categoryId,
    providerId: product.providerId,
    costPrice: cost,
    wholesalePrice: priceFromPercentage(cost, toNumber(settings.wholesalePercentage)),
    retailPrice: priceFromPercentage(cost, toNumber(settings.retailPercentage)),
    promo1Price: priceFromPercentage(cost, toNumber(settings.promo1Percentage)),
    promo2Price: priceFromPercentage(cost, toNumber(settings.promo2Percentage)),
    stockQuantity: toNumber(product.stock?.currentQuantity),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function publicProduct(product: ProductWithRelations, settings: PriceSetting) {
  const priced = withPrices(product, settings);
  const { costPrice, notes, ...safe } = priced;
  return safe;
}
