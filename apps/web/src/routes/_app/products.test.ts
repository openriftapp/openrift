import { imageUrl } from "@openrift/shared/image-url";
import { describe, expect, it, vi } from "vitest";

import { Route } from "./products";

type Loader = (ctx: unknown) => Promise<unknown>;

function runLoader(payload: unknown): Promise<unknown> {
  return (Route.options.loader as unknown as Loader)({
    context: { queryClient: { query: vi.fn(() => Promise.resolve(payload)) } },
  });
}

describe("/products loader", () => {
  it("keeps only the JSON-LD items, so the product list is not shipped twice", async () => {
    const data = await runLoader({
      products: [
        {
          slug: "origins-starter",
          name: "Origins Starter",
          coverCards: [{ imageId: "img-1" }],
          extra: "dropped",
        },
        { slug: "proving-grounds", name: "Proving Grounds", coverCards: [] },
      ],
    });

    expect(data).toEqual({
      items: [
        {
          url: "/products/origins-starter",
          name: "Origins Starter",
          image: imageUrl("img-1", "full"),
        },
        { url: "/products/proving-grounds", name: "Proving Grounds", image: undefined },
      ],
    });
  });
});
