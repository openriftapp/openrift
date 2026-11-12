import { describe, expect, it } from "vitest";

import { deckFormatLabel } from "./deck-format-label.js";

function repo(rows: Record<string, string>) {
  return {
    getBySlug: async (slug: string) => {
      const label = rows[slug];
      return label === undefined
        ? undefined
        : {
            slug,
            label,
            sortOrder: 0,
            isWellKnown: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
    },
  } as Parameters<typeof deckFormatLabel>[0];
}

describe("deckFormatLabel", () => {
  it("reads the admin-managed label", async () => {
    await expect(
      deckFormatLabel(repo({ "custom-region": "Custom Region" }), "custom-region"),
    ).resolves.toBe("Custom Region");
  });

  it("falls back to the slug when the format has no row", async () => {
    await expect(deckFormatLabel(repo({}), "homebrew")).resolves.toBe("homebrew");
  });
});
