import { initContract } from "@openrift/shared/contracts/init";
import type { InitResponse } from "@openrift/shared/types/api/init";
import { implement } from "@orpc/server";

import { requireUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import {
  toDistributionChannel,
  toEnumRows,
  toKeywordEntries,
  toTagCategoryMap,
} from "../../catalog/lib/reference-presenters.js";
import { toPublicCustomTag } from "../../collections/lib/custom-tag-presenters.js";

const os = implement(initContract).$context<ApiContext>().use(requireUser);

function stripInternal<T extends { isWellKnown: boolean }>(rows: T[]): Omit<T, "isWellKnown">[] {
  return rows.map(({ isWellKnown: _isWellKnown, ...rest }) => rest);
}

/**
 * Public init read.
 * `GET /api/v1/init` — enums + keywords + distribution channels + custom tags
 * in a single request.
 */
export const initRouter = {
  get: os.get.handler(async ({ context }): Promise<InitResponse> => {
    const {
      enums,
      keywords,
      distributionChannels,
      customTags,
      catalog,
      tagCategories,
      tagDefinitions,
    } = context.repos;
    const [
      enumData,
      keywordRows,
      translations,
      channelRows,
      customTagRows,
      championIdentifierTags,
      tagCategoryRows,
      tagDefinitionRows,
    ] = await Promise.all([
      enums.all(),
      keywords.listAll(),
      keywords.listAllTranslations(),
      distributionChannels.listAll(),
      customTags.listAll(),
      catalog.championIdentifierTags(),
      tagCategories.listAll(),
      tagDefinitions.listAll(),
    ]);

    // Listing keys explicitly keeps this checked against InitResponse["enums"];
    // folding over Object.entries would need an index-signature cast.
    const strippedEnums: InitResponse["enums"] = {
      cardTypes: stripInternal(enumData.cardTypes),
      rarities: stripInternal(enumData.rarities),
      domains: stripInternal(enumData.domains),
      superTypes: stripInternal(enumData.superTypes),
      finishes: stripInternal(enumData.finishes),
      artVariants: stripInternal(enumData.artVariants),
      cardSizes: stripInternal(enumData.cardSizes),
      deckFormats: stripInternal(enumData.deckFormats),
      deckZones: stripInternal(enumData.deckZones),
      conditions: stripInternal(enumData.conditions),
      graders: stripInternal(enumData.graders),
      languages: stripInternal(enumData.languages),
      markers: enumData.markers,
    };

    return {
      enums: strippedEnums,
      keywords: toKeywordEntries(keywordRows, translations),
      distributionChannels: channelRows.map((row) => toDistributionChannel(row)),
      customTags: customTagRows.map((row) => toPublicCustomTag(row)),
      championIdentifierTags,
      tagCategories: toEnumRows(tagCategoryRows),
      tagCategoryMap: toTagCategoryMap(tagDefinitionRows),
    };
  }),
};
