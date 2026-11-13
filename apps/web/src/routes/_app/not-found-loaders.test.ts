import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/lib/server-fns/api-error";
import { headTitle, runRouteHead } from "@/test/route-head";

import { Route as CorrectionRoute } from "./_authenticated/contribute_.card_.$cardSlug";
import { Route as AddPrintingRoute } from "./_authenticated/contribute_.card_.$cardSlug_.printing";
import { Route as PrintingCorrectionRoute } from "./_authenticated/contribute_.card_.$cardSlug_.printing_.$printingId";
import { Route as ImageRoute } from "./_authenticated/contribute_.card_.$cardSlug_.printing_.$printingId_.image";
import { Route as StaffInviteRoute } from "./tournaments_.staff-invite.$token";
import { Route as SubmitRoute } from "./tournaments_.submit.$token";

type Loader = (ctx: unknown) => Promise<unknown>;

const PARAMS = { cardSlug: "jinx-loose-cannon", printingId: "p-1", token: "BARON" };

function runLoader(route: { options: { loader?: unknown } }, payload: Promise<unknown>) {
  return (route.options.loader as Loader)({
    context: { queryClient: { query: vi.fn(() => payload) } },
    params: PARAMS,
  });
}

const CARD_DETAIL = {
  card: { id: "card-1", name: "Jinx", types: [], tags: [], slug: "jinx-loose-cannon" },
  printings: [{ printingId: "p-1" }],
};

describe("loaders for a card, invite or tournament that does not exist", () => {
  it.each([
    ["/contribute/card/$cardSlug", CorrectionRoute],
    ["/contribute/card/$cardSlug/printing", AddPrintingRoute],
    ["/contribute/card/$cardSlug/printing/$printingId", PrintingCorrectionRoute],
    ["/contribute/card/$cardSlug/printing/$printingId/image", ImageRoute],
    ["/tournaments/staff-invite/$token", StaffInviteRoute],
    ["/tournaments/submit/$token", SubmitRoute],
  ])("%s renders the not-found page", async (_path, route) => {
    const thrown = await runLoader(route, Promise.reject(notFoundError())).catch(
      (error: unknown) => error,
    );

    expect(isNotFound(thrown)).toBe(true);
  });
});

describe("contribute card loaders", () => {
  it.each([
    ["/contribute/card/$cardSlug", CorrectionRoute],
    ["/contribute/card/$cardSlug/printing", AddPrintingRoute],
    ["/contribute/card/$cardSlug/printing/$printingId", PrintingCorrectionRoute],
    ["/contribute/card/$cardSlug/printing/$printingId/image", ImageRoute],
  ])("%s keeps only the card name for the page title", async (_path, route) => {
    await expect(runLoader(route, Promise.resolve(CARD_DETAIL))).resolves.toEqual({
      cardName: "Jinx",
    });
  });
});

describe("contribute card heads without loader data", () => {
  it.each([
    [CorrectionRoute, "Suggest a correction - OpenRift"],
    [AddPrintingRoute, "Add a printing - OpenRift"],
    [PrintingCorrectionRoute, "Suggest a printing correction - OpenRift"],
    [ImageRoute, "Suggest an image - OpenRift"],
  ])("use a neutral title whatever made the loader fail", (route, title) => {
    expect(headTitle(runRouteHead(route, PARAMS, undefined))).toBe(title);
  });
});
