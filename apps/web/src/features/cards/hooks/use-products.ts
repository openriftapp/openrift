import { adminProductsContract } from "@openrift/shared/contracts/admin/products";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { productsKeys } from "@/features/cards/lib/cards-query-keys";
import {
  productDetailQueryOptions,
  productsListQueryOptions,
} from "@/features/cards/lib/products-queries";
import { serverCache } from "@/lib/server-cache";
import { withCookies } from "@/lib/server-fns/middleware";
import type { ContractInput } from "@/lib/server-fns/orpc-client";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

type CreateProductInput = ContractInput<typeof adminProductsContract, "create">;
type UpdateProductInput = ContractInput<typeof adminProductsContract, "update">;

export function useProductsList() {
  return useSuspenseQuery(productsListQueryOptions);
}

export function useProductDetail(slug: string) {
  return useSuspenseQuery(productDetailQueryOptions(slug));
}

// Mutations must bust this explicitly, or client-side invalidation refetches
// through the still-fresh server cache and pins the stale list.
function invalidateProductsServerCache(): Promise<void> {
  return serverCache.invalidateQueries({ queryKey: ["server-cache", "products"] });
}

const createProductFn = createServerFn({ method: "POST" })
  .validator((input: CreateProductInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const result = await apiOrpcClient(adminProductsContract, context.cookie).create(data);
    await invalidateProductsServerCache();
    return result;
  });

export function useCreateProduct() {
  return useMutationWithInvalidation({
    mutationFn: (vars: CreateProductInput) => createProductFn({ data: vars }),
    invalidates: [productsKeys.all],
  });
}

const resyncProductFn = createServerFn({ method: "POST" })
  .validator((input: { id: string; listId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminProductsContract, context.cookie).resyncContents(data);
    await invalidateProductsServerCache();
  });

export function useResyncProduct() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { id: string; listId: string }) => resyncProductFn({ data: vars }),
    invalidates: [productsKeys.all],
  });
}

const updateProductFn = createServerFn({ method: "POST" })
  .validator((input: UpdateProductInput) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminProductsContract, context.cookie).update(data);
    await invalidateProductsServerCache();
  });

export function useUpdateProduct() {
  return useMutationWithInvalidation({
    mutationFn: (vars: UpdateProductInput) => updateProductFn({ data: vars }),
    invalidates: [productsKeys.all],
  });
}

const deleteProductFn = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminProductsContract, context.cookie).remove(data);
    await invalidateProductsServerCache();
  });

export function useDeleteProduct() {
  return useMutationWithInvalidation({
    mutationFn: (vars: { id: string }) => deleteProductFn({ data: vars }),
    invalidates: [productsKeys.all],
  });
}
