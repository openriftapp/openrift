import { sentenceCaseSlug } from "@openrift/shared/strings";
import { Hono } from "hono";

import { assertFound } from "../../../lib/assertions.js";
import { pngResponse } from "../../../lib/http-response.js";
import { parseShareImageQuery } from "../../../lib/share-image-query.js";
import { shareUrlFromOrigin, siteHostFromOrigin } from "../../../lib/site-url.js";
import { getUserId } from "../../../middleware/get-user-id.js";
import { requireAuth } from "../../../middleware/require-auth.js";
import type { Variables } from "../../../types.js";
import { renderImage } from "../../system/services/render-pool.js";
import { buildDeckImageCards, resolveCoverImageId } from "../services/deck-image.js";

/**
 * Owner-authenticated download of a deck's share image, resolving the deck by
 * id (the public og:image route resolves by share token instead).
 */
export const deckImageRoute = new Hono<{ Variables: Variables }>()
  .basePath("/decks")
  // requireAuth is scoped to this one route: a bare `.use(requireAuth)` on the
  // sub-app would 401 the public `/decks/share/{token}` routes it doesn't collide with.
  .get("/:id/image.png", requireAuth, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");
    const userId = getUserId(c);
    const id = c.req.param("id");
    const { scale, aspect, qr: includeQr } = parseShareImageQuery((name) => c.req.query(name));

    const deck = await repos.decks.getByIdForUser(id, userId);
    assertFound(deck, "Not found");

    const cards = await buildDeckImageCards(repos, deck.id, userId);
    // QR is only meaningful for a publicly shared deck; `qr=0` opts out.
    const shareUrl =
      includeQr && deck.isPublic && deck.shareToken
        ? shareUrlFromOrigin(config.siteOrigin, `/decks/share/${deck.shareToken}`)
        : undefined;

    const png = await renderImage({
      kind: "deck",
      input: {
        deckName: deck.name,
        ownerName: c.get("user")?.name ?? undefined,
        formatLabel: sentenceCaseSlug(deck.format),
        cards,
        siteHost: siteHostFromOrigin(config.siteOrigin),
        shareUrl,
        coverImageId: await resolveCoverImageId(repos, deck),
      },
      scale,
      aspect,
    });

    return pngResponse(png);
  });
