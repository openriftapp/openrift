import { Hono } from "hono";

import { assertFound } from "../../../lib/assertions.js";
import { pngResponse } from "../../../lib/http-response.js";
import { parseShareImageQuery } from "../../../lib/share-image-query.js";
import { shareUrlFromOrigin, siteHostFromOrigin } from "../../../lib/site-url.js";
import { getUserId } from "../../../middleware/get-user-id.js";
import { requireAuth } from "../../../middleware/require-auth.js";
import type { Variables } from "../../../types.js";
import { renderImage } from "../../system/services/render-pool.js";
import { buildTierListImageRows } from "../services/tier-list-image.js";

/**
 * Resolves the caller's own list by id, unlike the public og:image route which
 * resolves by share token, so the export button works before a list is shared.
 */
export const tierListImageRoute = new Hono<{ Variables: Variables }>()
  .basePath("/tier-lists")
  // requireAuth is scoped to this route, not the `/tier-lists` sub-app, so it
  // doesn't 401 the public `/tier-lists/share/{token}` og:image.
  .get("/:id/image.png", requireAuth, async (c) => {
    const repos = c.get("repos");
    const config = c.get("config");
    const userId = getUserId(c);
    const { scale, aspect, qr: withQr } = parseShareImageQuery((name) => c.req.query(name));

    const tierList = await repos.tierLists.getByIdForUser(c.req.param("id"), userId);
    assertFound(tierList, "Not found");

    const rows = await buildTierListImageRows(repos, tierList.tiers);
    const shareUrl =
      withQr && tierList.isPublic && tierList.shareToken
        ? shareUrlFromOrigin(config.siteOrigin, `/tier-lists/share/${tierList.shareToken}`)
        : undefined;

    const png = await renderImage({
      kind: "tierList",
      input: {
        title: tierList.title,
        ownerName: c.get("user")?.name ?? undefined,
        rows,
        siteHost: siteHostFromOrigin(config.siteOrigin),
        shareUrl,
      },
      scale,
      aspect,
    });

    return pngResponse(png);
  });
