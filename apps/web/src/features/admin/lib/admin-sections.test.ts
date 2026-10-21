import { ADMIN_SECTION_SLUGS } from "@openrift/shared/admin-sections";
import { describe, expect, it } from "vitest";

import { ADMIN_SECTION_ROUTES, adminSectionsForPathname } from "./admin-sections";

describe("adminSectionsForPathname", () => {
  it("resolves a section route to its slug", () => {
    expect(adminSectionsForPathname("/admin/custom-tags")).toEqual(["custom-tags"]);
    expect(adminSectionsForPathname("/admin/products")).toEqual(["products"]);
    expect(adminSectionsForPathname("/admin/cards")).toEqual(["card-review"]);
  });

  it("resolves nested paths under a section route", () => {
    expect(adminSectionsForPathname("/admin/custom-tags/whatever")).toEqual(["custom-tags"]);
    expect(adminSectionsForPathname("/admin/cards/some-card-slug")).toEqual(["card-review"]);
    expect(adminSectionsForPathname("/admin/cards/new/some-name")).toEqual(["card-review"]);
  });

  it("resolves the review inbox to card-review", () => {
    expect(adminSectionsForPathname("/admin/review")).toEqual(["card-review"]);
  });

  it("resolves the printing pages to the printing desk", () => {
    expect(
      adminSectionsForPathname("/admin/printings/0190a000-0000-7000-8000-000000000001"),
    ).toEqual(["printing-desk"]);
  });

  it("matches on segment boundaries, not raw prefixes", () => {
    expect(adminSectionsForPathname("/admin/card-types")).toEqual([]);
    expect(adminSectionsForPathname("/admin/cardsX")).toEqual([]);
    expect(adminSectionsForPathname("/admin/workspaceX")).toEqual([]);
  });

  it("excludes the manual-create pages from card-review", () => {
    expect(adminSectionsForPathname("/admin/cards/create")).toEqual([]);
    expect(adminSectionsForPathname("/admin/cards/some-card/printings/create")).toEqual([]);
  });

  it("returns nothing for the admin root", () => {
    expect(adminSectionsForPathname("/admin")).toEqual([]);
    expect(adminSectionsForPathname("/admin/")).toEqual([]);
  });

  it("returns nothing for non-admin and unmapped paths", () => {
    expect(adminSectionsForPathname("/cards")).toEqual([]);
    expect(adminSectionsForPathname("/admin/sources")).toEqual([]);
    expect(adminSectionsForPathname("/admin/unmatched")).toEqual([]);
    expect(adminSectionsForPathname("")).toEqual([]);
  });

  describe("catalog workspace", () => {
    it("opens the workspace root to card-review and the printing desk", () => {
      expect(adminSectionsForPathname("/admin/workspace")).toEqual([
        "card-review",
        "printing-desk",
      ]);
      expect(adminSectionsForPathname("/admin/workspace/")).toEqual([
        "card-review",
        "printing-desk",
      ]);
    });

    it("maps the cards queue and its records to card-review only", () => {
      expect(adminSectionsForPathname("/admin/workspace/cards")).toEqual(["card-review"]);
      expect(adminSectionsForPathname("/admin/workspace/cards/some-card")).toEqual(["card-review"]);
      expect(adminSectionsForPathname("/admin/workspace/cards/new/some-name")).toEqual([
        "card-review",
      ]);
    });

    it("maps the printings queue and its records to both sections", () => {
      expect(adminSectionsForPathname("/admin/workspace/printings")).toEqual([
        "card-review",
        "printing-desk",
      ]);
      expect(
        adminSectionsForPathname("/admin/workspace/printings/0190a000-0000-7000-8000-000000000001"),
      ).toEqual(["card-review", "printing-desk"]);
      expect(adminSectionsForPathname("/admin/workspace/printings/new/candidate-1")).toEqual([
        "card-review",
        "printing-desk",
      ]);
    });

    it("keeps manual printing creation for the printing desk only", () => {
      expect(adminSectionsForPathname("/admin/workspace/printings/create")).toEqual([
        "printing-desk",
      ]);
    });

    it("keeps the faces list for card-review but opens face records to the desk", () => {
      expect(adminSectionsForPathname("/admin/workspace/faces")).toEqual(["card-review"]);
      expect(
        adminSectionsForPathname(
          "/admin/workspace/faces/some-card/0190a000-0000-7000-8000-000000000002",
        ),
      ).toEqual(["card-review", "printing-desk"]);
      expect(adminSectionsForPathname("/admin/workspace/faces/some-card/face-id/extra")).toEqual([
        "card-review",
      ]);
    });
  });
});

describe("ADMIN_SECTION_ROUTES", () => {
  it("round-trips every registered section through its route", () => {
    for (const slug of ADMIN_SECTION_SLUGS) {
      expect(adminSectionsForPathname(ADMIN_SECTION_ROUTES[slug])).toContain(slug);
    }
  });
});
