// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { DesignerCard } from "@/features/designer/stores/card-designer-store";
import type * as WhiteIcon from "@/lib/white-icon";

import { FramedCardImage } from "./framed-card-image";

const tinted = new Map<string, string>();
vi.mock("@/lib/white-icon", async (importOriginal) => ({
  ...(await importOriginal<typeof WhiteIcon>()),
  getCachedTintedIcon: (src: string, color: string) => tinted.get(`${color} ${src}`),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["init"], {
    enums: {
      cardTypes: [],
      rarities: [],
      domains: [],
      superTypes: [],
      finishes: [],
      artVariants: [],
      deckFormats: [],
      deckZones: [],
      formats: [],
      languages: [],
    },
    keywords: {},
  });
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

const card: DesignerCard = {
  name: "Ember Scout",
  domains: ["fury"],
  energy: 3,
  might: 4,
  power: null,
  mightBonus: null,
  type: "unit",
  superTypes: [],
  tags: [],
  rulesText: "",
  effectText: "",
  flavorText: "",
  rarity: "common",
  publicCode: "",
  artist: "",
};

function renderCard(patch: Partial<DesignerCard> = {}, onFrameError?: () => void) {
  return render(
    <FramedCardImage
      card={{ ...card, ...patch }}
      frameUrl="/media/card-frames/v1/unit-common-fury.webp"
      artist=""
      onFrameError={onFrameError}
    />,
    { wrapper: makeWrapper() },
  );
}

describe("FramedCardImage", () => {
  it("draws the might number on a unit", () => {
    const { getByText } = renderCard();
    expect(getByText("4")).toBeTruthy();
  });

  it("leaves might off a spell, in the picture and the label", () => {
    const { queryByText, getByRole } = renderCard({ type: "spell" });
    expect(queryByText("4")).toBeNull();
    expect(getByRole("img", { name: /Ember Scout/u }).getAttribute("aria-label")).not.toContain(
      "4",
    );
  });

  it("shows a +0 might bonus", () => {
    const { getByText } = renderCard({ mightBonus: 0 });
    expect(getByText("+0")).toBeTruthy();
  });

  it("reports a frame that fails to load", () => {
    const onFrameError = vi.fn();
    const { container } = renderCard({}, onFrameError);
    const frame = container.querySelector('img[src$="unit-common-fury.webp"]');
    expect(frame).toBeTruthy();
    fireEvent.error(frame as Element);
    expect(onFrameError).toHaveBeenCalledOnce();
  });

  it("draws mono glyphs black on the parchment", () => {
    const { container } = renderCard({ rulesText: "Gain :rb_might:." });
    const glyph = container.querySelector('img[alt="might"]');
    expect(glyph?.getAttribute("src")).toBe("/images/glyphs/might.svg");
    expect(glyph?.className).toContain("brightness-0");
    expect(glyph?.className).not.toContain("invert");
  });

  it("uses the pre-tinted glyph once it is cached, for the export", () => {
    tinted.set("#000000 /images/glyphs/might.svg", "data:image/png;base64,black");
    const { container } = renderCard({ rulesText: "Gain :rb_might:." });
    const glyph = container.querySelector('img[alt="might"]');
    expect(glyph?.getAttribute("src")).toBe("data:image/png;base64,black");
    expect(glyph?.className).not.toContain("brightness-0");
    tinted.clear();
  });
});
