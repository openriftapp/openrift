import { imageUrl } from "@openrift/shared/image-url";
import { describe, expect, it, vi } from "vitest";

import { Route } from "./sets";

type Loader = (ctx: unknown) => Promise<unknown>;

function runLoader(payload: unknown): Promise<unknown> {
  return (Route.options.loader as unknown as Loader)({
    context: { queryClient: { query: vi.fn(() => Promise.resolve(payload)) } },
  });
}

describe("/sets loader", () => {
  it("keeps only the JSON-LD items, so the set list is not shipped twice", async () => {
    const data = await runLoader({
      sets: [
        { slug: "origins", name: "Origins", coverImageId: "img-1", printingCount: 300 },
        { slug: "spiritforged", name: "Spiritforged", coverImageId: null },
      ],
    });

    expect(data).toEqual({
      items: [
        { name: "Origins", url: "/sets/origins", image: imageUrl("img-1", "full") },
        { name: "Spiritforged", url: "/sets/spiritforged", image: undefined },
      ],
    });
  });
});
