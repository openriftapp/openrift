// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({
    matchRoutes: () => [
      { routeId: "__root__", fullPath: "/" },
      { routeId: "/_app/_authenticated/collections", fullPath: "/collections" },
    ],
    history: { replace, location: { state: { __TSR_index: 3 } } },
  }),
}));

vi.mock("@/hooks/use-site-settings", () => ({
  useSiteSettingValue: () => undefined,
}));

const { Analytics } = await import("./analytics");

const track = vi.fn();

beforeEach(() => {
  replace.mockClear();
  track.mockClear();
  vi.stubGlobal("umami", { track });
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.history.replaceState(null, "", "/");
});

describe("Analytics", () => {
  it("counts a new social account and strips the flag through the router", () => {
    globalThis.history.replaceState(null, "", "/collections?tab=wants&signup=google#top");

    render(<Analytics />);

    expect(track).toHaveBeenCalledWith(
      "signup-verified",
      expect.objectContaining({ method: "google", from: "/collections" }),
    );
    expect(replace).toHaveBeenCalledWith("/collections?tab=wants#top", { __TSR_index: 3 });
  });

  it("ignores an unknown signup flag", () => {
    globalThis.history.replaceState(null, "", "/collections?signup=github");

    render(<Analytics />);

    expect(track).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("records the landing page as the first touch", () => {
    globalThis.history.replaceState(null, "", "/collections?utm_source=reddit");

    render(<Analytics />);

    expect(JSON.parse(localStorage.getItem("openrift:first-touch") ?? "null")).toEqual({
      path: "/collections",
      source: "reddit",
    });
  });
});
