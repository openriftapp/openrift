import { catalogContract } from "@openrift/shared/contracts/catalog";
import type { CatalogPrintingsResponse, CatalogResponse } from "@openrift/shared/types/api/catalog";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  assembleCatalogResponse,
  catalogPrintingsExcept,
  filterCatalogByLanguages,
  parseLanguageCodes,
} from "../services/catalog-assembly.js";

const os = implement(catalogContract).$context<ApiContext>().use(requireUser);

/**
 * The ETag is the catalog's content version, not a hash of the body, so every
 * language variant of one catalog state carries the same tag as `?v=<token>`.
 */
export const catalogRouter = {
  catalog: os.catalog.handler(async ({ context, input }): Promise<CatalogResponse> => {
    const [catalog, version] = await Promise.all([
      assembleCatalogResponse(context.repos),
      context.repos.catalog.catalogResponseVersion(),
    ]);
    context.response.etag = version;
    return filterCatalogByLanguages(
      catalog,
      input.langs === undefined ? undefined : parseLanguageCodes(input.langs),
    );
  }),

  printings: os.printings.handler(async ({ context, input }): Promise<CatalogPrintingsResponse> => {
    const [catalog, version] = await Promise.all([
      assembleCatalogResponse(context.repos),
      context.repos.catalog.catalogResponseVersion(),
    ]);
    context.response.etag = version;
    return catalogPrintingsExcept(catalog, parseLanguageCodes(input.exceptLangs));
  }),
};
