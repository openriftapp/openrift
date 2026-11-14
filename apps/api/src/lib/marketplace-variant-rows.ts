import { marketplaceSkuKey } from "@openrift/shared/marketplace-sku-key";

interface ProductSku {
  marketplace: string;
  externalId: number;
  finish: string;
  language: string | null;
}

export function variantRowsFor(
  caller: string,
  products: readonly (ProductSku & { id: string })[],
  values: readonly (ProductSku & { printingId: string })[],
): { marketplaceProductId: string; printingId: string }[] {
  const productIdByKey = new Map(
    products.map((p) => [
      marketplaceSkuKey(p.marketplace, p.externalId, p.finish, p.language),
      p.id,
    ]),
  );
  return values.map((v) => {
    const productId = productIdByKey.get(
      marketplaceSkuKey(v.marketplace, v.externalId, v.finish, v.language),
    );
    if (!productId) {
      throw new Error(
        `${caller}: missing product id for ${v.marketplace} ${v.externalId} ${v.finish}/${v.language ?? "NULL"}`,
      );
    }
    return { marketplaceProductId: productId, printingId: v.printingId };
  });
}
