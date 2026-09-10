import { cardmarketPicksContract } from "@openrift/shared/contracts/cardmarket-picks";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { presentCardmarketPicksResolution } from "../lib/cardmarket-picks-presenters.js";
import {
  indexProductPrintings,
  resolveCardmarketProduct,
} from "../lib/cardmarket-product-resolve.js";

const os = implement(cardmarketPicksContract).$context<ApiContext>().use(requireAuthedUser);

export const cardmarketPicksRouter = {
  resolve: os.resolve.handler(async ({ input, context }) => {
    const productPrintings = await context.repos.cardmarketStock.productPrintings(
      input.rows.map((row) => row.idProduct),
    );
    const index = indexProductPrintings(productPrintings);
    const rows = input.rows.map((query) => ({
      query,
      resolution: resolveCardmarketProduct(query, index),
    }));
    return presentCardmarketPicksResolution(rows, productPrintings);
  }),
};
