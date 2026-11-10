import type { AnyRedirect } from "@tanstack/react-router";
import { isRedirect } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { Route as PrintingDeskPrintingRoute } from "./_authenticated/admin/printing-desk_.printings.$printingId";
import { Route as ContributeCardRoute } from "./contribute_.$cardSlug";
import { Route as ContributeImageRoute } from "./contribute_.$cardSlug_.image.$printingId";
import { Route as PromosLanguageRoute } from "./promos_.$language";
import { Route as RoadmapRoute } from "./roadmap";

type Hook = (ctx: Record<string, unknown>) => unknown;

async function thrownBy(run: () => unknown): Promise<AnyRedirect> {
  try {
    await run();
  } catch (error) {
    expect(isRedirect(error)).toBe(true);
    return error as AnyRedirect;
  }
  throw new Error("nothing was thrown");
}

describe("moved URLs answer with a permanent redirect", () => {
  it("/roadmap moved to the changelog milestones", async () => {
    const thrown = await thrownBy(() => (RoadmapRoute.options.loader as unknown as Hook)({}));

    expect(thrown.options).toMatchObject({ to: "/changelog", statusCode: 301 });
  });

  it("/contribute/$cardSlug moved under /contribute/card", async () => {
    const thrown = await thrownBy(() =>
      (ContributeCardRoute.options.loader as unknown as Hook)({ params: { cardSlug: "jinx" } }),
    );

    expect(thrown.options).toMatchObject({ to: "/contribute/card/$cardSlug", statusCode: 301 });
  });

  it("/contribute/$cardSlug/image/$printingId moved under /contribute/card", async () => {
    const thrown = await thrownBy(() =>
      (ContributeImageRoute.options.loader as unknown as Hook)({
        params: { cardSlug: "jinx", printingId: "p-1" },
      }),
    );

    expect(thrown.options).toMatchObject({
      to: "/contribute/card/$cardSlug/printing/$printingId/image",
      statusCode: 301,
    });
  });

  it("/promos with a renamed language code moved to the current code", async () => {
    const thrown = await thrownBy(() =>
      (PromosLanguageRoute.options.beforeLoad as unknown as Hook)({
        params: { language: "zh" },
        search: {},
        location: { searchStr: "" },
      }),
    );

    expect(thrown.options).toMatchObject({ params: { language: "SC" }, statusCode: 301 });
  });

  it("the old printing desk printing page moved to the printing page", async () => {
    const thrown = await thrownBy(() =>
      (PrintingDeskPrintingRoute.options.beforeLoad as unknown as Hook)({
        params: { printingId: "p-1" },
      }),
    );

    expect(thrown.options).toMatchObject({
      to: "/admin/printings/$printingId",
      statusCode: 301,
    });
  });
});
