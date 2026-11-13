import { compareCardDisplayName, legendDisplayName } from "@openrift/shared/card-name";
import { labelMap } from "@openrift/shared/enum-label";
import { ERROR_CODES } from "@openrift/shared/error-codes";
import { deckImageBodySchema } from "@openrift/shared/share-image-params";
import { userBundleShareTitle } from "@openrift/shared/share-titles";
import { cardPath } from "@openrift/shared/site-paths";
import { pluralize } from "@openrift/shared/strings";
import { WellKnown } from "@openrift/shared/well-known";
import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { AppError } from "../../../errors.js";
import { assertFound } from "../../../lib/assertions.js";
import { IMAGE_CACHE, jsonError, pngResponse } from "../../../lib/http-response.js";
import { imageRateLimit } from "../../../lib/image-rate-limit.js";
import { parseShareImageQuery } from "../../../lib/share-image-query.js";
import { bylineName } from "../../../lib/share-owner.js";
import { shareUrlFromOrigin, siteHostFromOrigin } from "../../../lib/site-url.js";
import type { Variables } from "../../../types.js";
import { buildCardShareInput } from "../../catalog/services/card-share-input.js";
import { buildDevelopersImageInput } from "../../catalog/services/developers-image-input.js";
import { buildCollectionShareInput } from "../../collections/services/collection-image.js";
import { deckFormatLabel, deckZoneLabels } from "../../decks/lib/deck-format-label.js";
import {
  buildDeckImageCards,
  buildDeckImageCardsFromRefs,
  resolveCoverImageId,
  splitDeckZones,
} from "../../decks/services/deck-image.js";
import { buildCards, buildListShareInput, topByQuantity } from "../../lists/services/list-image.js";
import { metaDeckImageFraming } from "../../meta/lib/meta-share-image.js";
import { buildTierListImageRows } from "../../stage/services/tier-list-image.js";
import { renderImage } from "../services/render-pool.js";
import type { ShareImageCard } from "../services/share-image.js";

/**
 * No `loadSession`: images are cached immutably for anonymous crawlers, so
 * every response must render the public-only projection regardless of viewer.
 * `?v=` is a cache-busting version the handler ignores; it only changes the
 * edge cache key.
 */

/** Card images carry prices, which refresh daily; their URLs have no version. */
const CARD_IMAGE_CACHE_CONTROL = IMAGE_CACHE.daily;

const MAX_RENDER_CARD_ROWS = 300;

/** Matches the deck contract's name limit; anything longer only inflates satori layout. */
const MAX_RENDER_TEXT_LENGTH = 200;

// POST /decks/image is anonymous, uncached, and CPU-heavy, so it gets a per-IP
// rate limit and a body cap that rejects oversized payloads before JSON parsing.
// A legitimate 300-card payload is a few tens of KB.
const RENDER_MAX_BODY_BYTES = 256 * 1024;
const RENDERS_PER_MINUTE = 10;

// og:image points crawlers at the GETs below and each render costs ~3s of CPU,
// above the pool's throughput. An unfurler fetches a given link once.
const SHARE_IMAGE_RENDERS_PER_MINUTE = 20;

const renderRateLimit = imageRateLimit(RENDERS_PER_MINUTE, "ip");

const shareImageRateLimit = imageRateLimit(SHARE_IMAGE_RENDERS_PER_MINUTE, "ip");

// Throwing routes the rejection through `app.onError`, so it answers with the
// same `ApiErrorResponse` envelope as every other error on this route.
const renderBodyLimit = bodyLimit({
  maxSize: RENDER_MAX_BODY_BYTES,
  onError: () => {
    throw new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, "Render payload exceeds 256 KB");
  },
});

function publicQuery(c: Context<{ Variables: Variables }>) {
  return parseShareImageQuery((name) => c.req.query(name), "public");
}

function shareJobQuery(c: Context<{ Variables: Variables }>) {
  const { scale, aspect, qr } = publicQuery(c);
  return { scale, options: { aspect, qr } };
}

/**
 * Collapses cards that recur across a bundle's lists into one tile, keeping the
 * first occurrence's quantity: summing across lists would misrepresent "how
 * many of this card" for a mixed wish/trade bundle.
 */
function dedupeCards(cards: readonly ShareImageCard[]): ShareImageCard[] {
  const byKey = new Map<string, ShareImageCard>();
  for (const card of cards) {
    const key = card.imageId ?? `name:${card.cardName}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...card });
    }
  }
  return [...byKey.values()];
}

async function cardImage(
  c: Context<{ Variables: Variables }>,
  cardSlug: string,
  printingSlug?: string,
): Promise<Response> {
  const { catalog, enums, marketplace } = c.get("repos");
  const config = c.get("config");

  const card = await catalog.cardBySlug(cardSlug);
  assertFound(card, "Not found");
  const printings = await catalog.printingsByCardId(card.id);
  const printingIds = [...new Set(printings.map((printing) => printing.printingId))];
  const [images, sets, prices, enumRows] = await Promise.all([
    catalog.printingImagesByPrintingIds(printingIds),
    catalog.setsByIds([...new Set(printings.map((printing) => printing.setId))]),
    marketplace.latestPricesForPrintings(printingIds),
    enums.all(),
  ]);

  const path = cardPath(cardSlug, printingSlug);
  const input = buildCardShareInput({
    card,
    printings,
    images,
    sets,
    prices,
    labels: {
      domains: labelMap(enumRows.domains),
      superTypes: labelMap(enumRows.superTypes),
      cardTypes: labelMap(enumRows.cardTypes),
      rarities: labelMap(enumRows.rarities),
    },
    printingSlug,
    siteHost: siteHostFromOrigin(config.siteOrigin),
    shareUrl: shareUrlFromOrigin(config.siteOrigin, path),
  });
  assertFound(input, "Not found");

  const { scale, qr } = publicQuery(c);
  const png = await renderImage({ kind: "card", input, scale, qr });
  return pngResponse(png, CARD_IMAGE_CACHE_CONTROL);
}

export const publicShareImagesRoute = new Hono<{ Variables: Variables }>()
  .get("/cards/:cardSlug/image.png", shareImageRateLimit, (c) =>
    cardImage(c, c.req.param("cardSlug")),
  )

  .get("/cards/:cardSlug/:printingSlug/image.png", shareImageRateLimit, (c) =>
    cardImage(c, c.req.param("cardSlug"), c.req.param("printingSlug")),
  )

  .get("/lists/share/:token/image.png", shareImageRateLimit, async (c) => {
    const { lists, canonicalPrintings } = c.get("repos");
    const config = c.get("config");
    const token = c.req.param("token");

    const found = await lists.getByShareToken(token);
    assertFound(found, "Not found");

    const entries = await lists.entriesWithDetailsAnon(found.list.id, found.list.kind);
    const input = await buildListShareInput({
      ownerName: bylineName(found.ownerName),
      listName: found.list.name,
      intent: found.list.intent,
      kind: found.list.kind,
      entries,
      siteHost: siteHostFromOrigin(config.siteOrigin),
      shareUrl: shareUrlFromOrigin(config.siteOrigin, `/lists/share/${token}`),
      canonicalPrintings,
    });
    const png = await renderImage({
      kind: "share",
      input,
      ...shareJobQuery(c),
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/users/share/:token/image.png", shareImageRateLimit, async (c) => {
    const { userShares, lists, canonicalPrintings } = c.get("repos");
    const config = c.get("config");
    const token = c.req.param("token");

    const owner = await userShares.findOwnerByShareToken(token);
    assertFound(owner, "Not found");

    // Anonymous projection only (viewerUserId = null): the image is public and
    // immutably cached, so it must not depend on who is viewing.
    const summaries = await userShares.listsForOwner(owner.userId, null);
    const entriesPerList = await Promise.all(
      summaries.map((summary) => lists.entriesWithDetailsAnon(summary.list.id, summary.list.kind)),
    );
    const cards = dedupeCards(
      await buildCards(topByQuantity(entriesPerList.flat()), canonicalPrintings),
    );

    const png = await renderImage({
      kind: "share",
      input: {
        ownerName: bylineName(owner.displayName),
        title: userBundleShareTitle(null),
        intentLabel: `${summaries.length} ${pluralize(summaries.length, "list")}`,
        unit: { one: "card", many: "cards" },
        cards,
        totalCount: cards.length,
        siteHost: siteHostFromOrigin(config.siteOrigin),
        shareUrl: shareUrlFromOrigin(config.siteOrigin, `/users/share/${token}`),
      },
      ...shareJobQuery(c),
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/collections/share/:token/image.png", shareImageRateLimit, async (c) => {
    const { collections, copies } = c.get("repos");
    const config = c.get("config");
    const token = c.req.param("token");

    // getByShareToken only resolves public collections, so a private token (or
    // an unknown one) 404s — the image must never leak a non-shared collection.
    const found = await collections.getByShareToken(token);
    assertFound(found, "Not found");

    const input = await buildCollectionShareInput({
      collectionId: found.collection.id,
      ownerName: bylineName(found.ownerName),
      collectionName: found.collection.name,
      siteHost: siteHostFromOrigin(config.siteOrigin),
      shareUrl: shareUrlFromOrigin(config.siteOrigin, `/collections/share/${token}`),
      copies,
    });
    const png = await renderImage({
      kind: "share",
      input,
      ...shareJobQuery(c),
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/decks/share/:token/image.png", shareImageRateLimit, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");
    const token = c.req.param("token");

    const found = await repos.decks.getByShareToken(token);
    assertFound(found, "Not found");

    const [cards, metaContext] = await Promise.all([
      buildDeckImageCards(repos, found.deck.id, found.deck.userId),
      repos.meta.contextForDeck(found.deck.id),
    ]);
    const archive = metaContext
      ? metaDeckImageFraming(metaContext, splitDeckZones(cards).legend?.cardName ?? null)
      : null;

    const { scale, aspect, qr } = publicQuery(c);
    const path = archive ? `/meta/decks/${token}` : `/decks/share/${token}`;
    const shareUrl = qr ? shareUrlFromOrigin(config.siteOrigin, path) : undefined;

    const png = await renderImage({
      kind: "deck",
      input: {
        deckName: archive?.deckName ?? found.deck.name,
        ownerName: archive ? archive.ownerName : bylineName(found.ownerName),
        formatLabel: await deckFormatLabel(repos.deckFormats, found.deck.format),
        zoneLabels: await deckZoneLabels(repos.enums),
        resultLine: archive?.resultLine,
        cards,
        siteHost: siteHostFromOrigin(config.siteOrigin),
        shareUrl,
        coverImageId: await resolveCoverImageId(repos, found.deck),
      },
      scale,
      aspect,
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/tier-lists/share/:token/image.png", shareImageRateLimit, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");
    const token = c.req.param("token");

    // getByShareToken requires is_public, so a revoked link 404s here exactly
    // as it does on the share page itself.
    const found = await repos.tierLists.getByShareToken(token);
    assertFound(found, "Not found");

    const rows = await buildTierListImageRows(repos, found.tierList.tiers);
    const { scale, aspect, qr } = publicQuery(c);
    const shareUrl = qr
      ? shareUrlFromOrigin(config.siteOrigin, `/tier-lists/share/${token}`)
      : undefined;

    const png = await renderImage({
      kind: "tierList",
      input: {
        title: found.tierList.title,
        ownerName: bylineName(found.ownerName),
        rows,
        siteHost: siteHostFromOrigin(config.siteOrigin),
        shareUrl,
      },
      scale,
      aspect,
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/board-states/share/:token/image.png", shareImageRateLimit, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");

    const found = await repos.boardStates.getByShareToken(c.req.param("token"));
    assertFound(found, "Not found");

    const png = await renderImage({
      kind: "boardState",
      input: {
        title: found.boardState.title,
        ownerName: bylineName(found.ownerName),
        document: found.boardState.document,
        siteHost: siteHostFromOrigin(config.siteOrigin),
      },
      scale: publicQuery(c).scale,
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/errata/image.png", shareImageRateLimit, async (c) => {
    const { cardErrata } = c.get("repos");
    const config = c.get("config");

    const [announcements, rows] = await Promise.all([
      cardErrata.announcements(),
      cardErrata.listEntries(),
    ]);
    const newest = announcements.at(0);
    const cards = rows
      .filter((row) => newest !== undefined && row.announcementId === newest.id)
      .filter((row) => row.imageId !== null)
      .toSorted(compareCardDisplayName)
      .slice(0, 3)
      .map((row) => ({ cardName: legendDisplayName(row), imageId: row.imageId }));

    const png = await renderImage({
      kind: "errata",
      input: {
        cards,
        cardCount: new Set(rows.map((row) => row.slug)).size,
        updateCount: announcements.length,
        siteHost: siteHostFromOrigin(config.siteOrigin),
      },
      scale: publicQuery(c).scale,
    });

    return pngResponse(png, IMAGE_CACHE.versioned);
  })

  .get("/developers/image.png", shareImageRateLimit, async (c) => {
    const { value: catalog } = await c.get("repos").catalogResponse.current();
    const png = await renderImage({
      kind: "developers",
      input: buildDevelopersImageInput(catalog, siteHostFromOrigin(c.get("config").siteOrigin)),
      scale: publicQuery(c).scale,
    });

    return pngResponse(png, IMAGE_CACHE.daily);
  })

  // Browser-local decks have no server row or session; saved decks use the
  // owner-auth GET route (`deck-image.ts`) instead.
  .post("/decks/image", renderRateLimit, renderBodyLimit, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");

    const parsed = deckImageBodySchema.safeParse(await c.req.json().catch(() => null));
    if (
      !parsed.success ||
      parsed.data.cards.length === 0 ||
      parsed.data.cards.length > MAX_RENDER_CARD_ROWS
    ) {
      return jsonError(c, 400, "Invalid deck");
    }
    const body = parsed.data;

    const refs = body.cards.map((card) => ({
      cardId: card.cardId,
      preferredPrintingId: card.preferredPrintingId ?? null,
      quantity: card.quantity || 1,
      zone: card.zone,
    }));

    const { scale, aspect } = publicQuery(c);
    const imageCards = await buildDeckImageCardsFromRefs(repos, refs, { skipUnknown: true });
    const png = await renderImage({
      kind: "deck",
      input: {
        deckName: body.deckName ? body.deckName.slice(0, MAX_RENDER_TEXT_LENGTH) : "Deck",
        ownerName: bylineName(body.ownerName)?.slice(0, MAX_RENDER_TEXT_LENGTH),
        formatLabel: await deckFormatLabel(
          repos.deckFormats,
          body.format
            ? body.format.slice(0, MAX_RENDER_TEXT_LENGTH)
            : WellKnown.deckFormat.CONSTRUCTED,
        ),
        zoneLabels: await deckZoneLabels(repos.enums),
        cards: imageCards,
        siteHost: siteHostFromOrigin(config.siteOrigin),
      },
      scale,
      aspect,
    });

    return pngResponse(png);
  });
