import { describe, expect, it } from "vitest";

import { collectContractRoutes } from "../lib/contract-routes.js";
import { createApiRouteResolver } from "../orpc/router.js";
import { adminSectionsOf, sectionsFromRoute } from "./require-admin.js";

const ADMIN_PREFIX = "/api/admin/v1";

const GRANTED: Record<string, string[]> = {
  "DELETE /cards/printing-images/{imageId}": ["printing-desk"],
  "DELETE /custom-tag-categories/{id}": ["custom-tags"],
  "DELETE /custom-tags/{id}": ["custom-tags"],
  "DELETE /custom-tags/{id}/cards": ["custom-tags"],
  "DELETE /printing-desk/printings/{printingId}/second-side": ["printing-desk"],
  "DELETE /printings/{printingId}/citations/{citationId}": ["printing-desk"],
  "DELETE /products/{id}": ["products"],
  "DELETE /tag-categories/{id}": ["card-tags"],
  "GET /card-tags": ["card-tags"],
  "GET /card-tags/translations": ["card-tags"],
  "GET /cards": ["card-review"],
  "GET /cards/all-cards": ["card-review", "custom-tags", "printing-desk"],
  "GET /cards/distinct-artists": ["card-review", "printing-desk"],
  "GET /cards/new/{name}": ["card-review"],
  "GET /cards/{cardSlug}": ["card-review", "printing-desk"],
  "GET /cards/{id}/custom-tags": ["custom-tags"],
  "GET /catalog/review": ["card-review"],
  "GET /catalog/sources": ["card-review"],
  "GET /catalog/workspace/candidate-printings/{candidatePrintingId}/card": [
    "card-review",
    "printing-desk",
  ],
  "GET /catalog/workspace/card-images": ["card-review", "printing-desk"],
  "GET /catalog/workspace/history": ["card-review", "printing-desk"],
  "GET /catalog/workspace/records": ["card-review", "printing-desk"],
  "GET /catalog/workspace/review": ["card-review"],
  "GET /custom-tag-categories": ["custom-tags"],
  "GET /custom-tags": ["custom-tags"],
  "GET /custom-tags/assignments": ["custom-tags"],
  "GET /distribution-channels": ["card-review", "printing-desk"],
  "GET /finishes": ["printing-desk"],
  "GET /languages": ["card-review", "printing-desk"],
  "GET /markers": ["card-review", "printing-desk"],
  "GET /printing-citations/by-card/{cardId}": ["printing-desk"],
  "GET /printing-desk/cards/{cardSlug}": ["card-review", "printing-desk"],
  "GET /printing-desk/printings": ["printing-desk"],
  "GET /printing-desk/printings/{printingId}": ["card-review", "printing-desk"],
  "GET /printings/{printingId}/citations": ["printing-desk"],
  "GET /products/printing-ids": ["products"],
  "GET /provider-settings": ["card-review"],
  "GET /sets": ["card-review", "printing-desk"],
  "GET /tag-categories": ["card-tags"],
  "PATCH /cards/candidate-printings/{id}": ["card-review"],
  "PATCH /custom-tag-categories/{id}": ["custom-tags"],
  "PATCH /custom-tags/{id}": ["custom-tags"],
  "PATCH /printing-desk/images/{imageFileId}": ["printing-desk"],
  "PATCH /printing-desk/printing-images/{printingImageId}": ["printing-desk"],
  "PATCH /printing-desk/printings/{printingId}": ["printing-desk"],
  "PATCH /printings/{printingId}/citations/{citationId}": ["printing-desk"],
  "PATCH /products/{id}": ["products"],
  "PATCH /tag-categories/{id}": ["card-tags"],
  "POST /card-tags/detect-legends": ["card-tags"],
  "POST /card-tags/translations/discover": ["card-tags"],
  "POST /card-tags/translations/remove": ["card-tags"],
  "POST /cards/candidate-printings/{id}/set-image": ["card-review"],
  "POST /cards/new/{name}/accept": ["card-review"],
  "POST /cards/printing-images/{imageId}/activate": ["card-review", "printing-desk"],
  "POST /cards/printing-images/{imageId}/keep": ["card-review"],
  "POST /cards/printing-images/{imageId}/unkeep": ["card-review"],
  "POST /cards/printing-images/{imageId}/original": ["printing-desk"],
  "POST /cards/printing-images/{imageId}/quad": ["printing-desk"],
  "POST /cards/printing-images/{imageId}/rehost": ["card-review"],
  "POST /cards/printing-images/{imageId}/rotate": ["card-review", "printing-desk"],
  "POST /cards/printing-images/{imageId}/set-needs-levels": ["card-review"],
  "POST /cards/printing-images/{imageId}/set-needs-trim": ["card-review"],
  "POST /cards/printing/{printingId}/accept-field": ["card-review"],
  "POST /cards/printing/{printingId}/upload-image": ["printing-desk"],
  "POST /cards/{cardId}/accept-field": ["card-review"],
  "POST /cards/{cardId}/accept-printing": ["card-review"],
  "POST /cards/{cardId}/accept-printings": ["card-review"],
  "POST /catalog/submissions/{candidateCardId}/accept": ["card-review"],
  "POST /catalog/submissions/{candidateCardId}/reject": ["card-review"],
  "POST /custom-tag-categories": ["custom-tags"],
  "POST /custom-tags": ["custom-tags"],
  "POST /custom-tags/{id}/cards": ["custom-tags"],
  "POST /distribution-channels": ["printing-desk"],
  "POST /markers": ["printing-desk"],
  "POST /printing-desk/printings": ["printing-desk"],
  "POST /printings/{printingId}/citations": ["printing-desk"],
  "POST /products": ["products"],
  "POST /tag-categories": ["card-tags"],
  "PUT /card-tags/classification": ["card-tags"],
  "PUT /card-tags/translations": ["card-tags"],
  "PUT /cards/{id}/custom-tags": ["custom-tags"],
  "PUT /printing-desk/printings/{printingId}/second-side": ["printing-desk"],
  "PUT /products/{id}/contents": ["products"],
};

describe("admin section meta", () => {
  it("opens exactly the granted admin procedures to their sections", () => {
    const granted = Object.fromEntries(
      collectContractRoutes()
        .filter(({ path }) => path.startsWith(`${ADMIN_PREFIX}/`))
        .map(({ method, path, meta }) => ({
          route: `${method} ${path.slice(ADMIN_PREFIX.length)}`,
          sections: adminSectionsOf(meta),
        }))
        .filter(({ sections }) => sections.length > 0)
        .map(({ route, sections }) => [route, sections]),
    );
    expect(granted).toEqual(GRANTED);
  });

  it("names only known sections", () => {
    for (const { meta } of collectContractRoutes()) {
      if (meta.adminSections !== undefined) {
        expect(adminSectionsOf(meta)).toEqual(meta.adminSections);
      }
    }
  });

  it("reads the sections of the procedure the handler dispatches to", async () => {
    const resolve = sectionsFromRoute(createApiRouteResolver());
    const sectionsFor = (method: string, path: string) => resolve(method, `${ADMIN_PREFIX}${path}`);

    expect(await sectionsFor("GET", "/cards/all-cards")).toEqual([
      "card-review",
      "custom-tags",
      "printing-desk",
    ]);
    expect(await sectionsFor("GET", "/cards/some-card")).toEqual(["card-review", "printing-desk"]);
    expect(await sectionsFor("GET", "/cards/new/custom-tags")).toEqual(["card-review"]);
    expect(await sectionsFor("DELETE", "/cards/candidate-printings/x")).toEqual([]);
    expect(await sectionsFor("GET", "/no-such-route")).toEqual([]);
  });
});
