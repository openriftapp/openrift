import type {
  AdminCardDetailResponse,
  AdminMarketplaceName,
} from "@openrift/shared/types/api/admin";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CardSection } from "@/features/admin/lib/card-sections";
import {
  getCollapsedSections,
  getStoredCollapsedPrintings,
  useAdminCardFoldStore,
} from "@/features/admin/stores/admin-card-fold-store";
import { makeAdminCardDetail, makeAdminPrinting, makeCandidatePrinting } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

import { useCardPageFocus } from "./use-card-page-focus";

const CARD = "jinx-loose-cannon";

const enNonfoil = makeAdminPrinting({
  id: "p-en",
  faceId: "face-en",
  finish: "nonfoil",
  language: "EN",
});
const jpFoil = makeAdminPrinting({
  id: "p-jp-foil",
  faceId: "face-jp",
  finish: "foil",
  language: "JP",
});
const enFoil = makeAdminPrinting({
  id: "p-en-foil",
  faceId: "face-en-foil",
  finish: "foil",
  language: "EN",
});
const candidate = makeCandidatePrinting({ id: "cand-1" });

function detailWith(overrides: Partial<AdminCardDetailResponse> = {}): AdminCardDetailResponse {
  return makeAdminCardDetail({
    printings: [enNonfoil, jpFoil, enFoil],
    candidatePrintings: [candidate],
    candidatePrintingGroups: [
      {
        mostCommonShortCode: "OGN-002",
        shortCodes: ["cand-1"],
        expectedPrintingId: "OGN-002",
        language: "EN",
        suggestedPrintingId: null,
      },
    ],
    ...overrides,
  });
}

const ALL_KEYS = ["face-en", "face-jp", "face-en-foil", "cand-1"];

function collapsed(): string[] | undefined {
  const stored = getStoredCollapsedPrintings(useAdminCardFoldStore.getState(), CARD);
  return stored === undefined ? undefined : [...stored].toSorted();
}

function openKeys(): string[] {
  const folded = new Set(collapsed());
  return ALL_KEYS.filter((key) => !folded.has(key));
}

interface Props {
  detail?: AdminCardDetailResponse;
  face?: string;
  section?: CardSection;
  focusMarketplace?: AdminMarketplaceName;
  focusFinish?: string;
  focusLanguage?: string;
}

const goToSection = vi.fn<(section: CardSection) => Promise<unknown>>();
let frames: FrameRequestCallback[] = [];
let scrolls: { target: string; block: ScrollLogicalPosition | undefined }[] = [];
let resetStore: () => void;
const originalScrollIntoView = Element.prototype.scrollIntoView;

function flushFrames() {
  const pending = frames;
  frames = [];
  for (const frame of pending) {
    frame(0);
  }
}

function targetOf(element: HTMLElement): string {
  return element.dataset.faceId ?? element.dataset.printingGroup ?? `#${element.id}`;
}

function mountTargets() {
  for (const faceId of ["face-en", "face-jp", "face-en-foil"]) {
    const node = document.createElement("div");
    node.dataset.faceId = faceId;
    document.body.append(node);
  }
  const group = document.createElement("div");
  group.dataset.printingGroup = "cand-1";
  document.body.append(group);
  const decisions = document.createElement("section");
  decisions.id = "needs-decision";
  document.body.append(decisions);
}

function renderFocus(initial: Props) {
  return renderHook((props: Props) => useCardPageFocus({ cardId: CARD, goToSection, ...props }), {
    initialProps: initial,
  });
}

beforeEach(() => {
  resetStore = createStoreResetter(useAdminCardFoldStore);
  frames = [];
  scrolls = [];
  goToSection.mockReset();
  goToSection.mockResolvedValue(undefined);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  Element.prototype.scrollIntoView = function scrollIntoView(
    this: HTMLElement,
    options?: boolean | ScrollIntoViewOptions,
  ) {
    scrolls.push({
      target: targetOf(this),
      block: typeof options === "object" ? options.block : undefined,
    });
  };
  mountTargets();
});

afterEach(() => {
  resetStore();
  vi.unstubAllGlobals();
  Element.prototype.scrollIntoView = originalScrollIntoView;
  document.body.replaceChildren();
});

describe("fold seeding", () => {
  it("folds every face and new-printing group once the detail lands", () => {
    const { rerender } = renderFocus({});
    expect(collapsed()).toBeUndefined();

    rerender({ detail: detailWith() });

    expect(collapsed()).toEqual([...ALL_KEYS].toSorted());
  });

  it("keeps the folds remembered from an earlier visit", () => {
    useAdminCardFoldStore.getState().setCollapsedForCard(CARD, new Set(["face-jp"]));

    renderFocus({ detail: detailWith() });

    expect(collapsed()).toEqual(["face-jp"]);
  });
});

describe("face deep link", () => {
  it("opens only that face and scrolls it to the centre on the next frame", () => {
    renderFocus({ detail: detailWith(), face: "face-jp" });

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toEqual([]);
    flushFrames();
    expect(scrolls).toEqual([{ target: "face-jp", block: "center" }]);
  });

  it("overrides remembered folds", () => {
    useAdminCardFoldStore.getState().setCollapsedForCard(CARD, new Set());

    renderFocus({ detail: detailWith(), face: "face-en" });

    expect(openKeys()).toEqual(["face-en"]);
  });

  it("waits for the detail to load", () => {
    const { rerender } = renderFocus({ face: "face-jp" });
    flushFrames();
    expect(scrolls).toEqual([]);

    rerender({ detail: detailWith(), face: "face-jp" });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toEqual([{ target: "face-jp", block: "center" }]);
  });

  it("waits for a refetch that brings the face, leaving the folds alone until then", () => {
    const before = detailWith({ printings: [enNonfoil] });
    const { rerender } = renderFocus({ detail: before, face: "face-jp" });
    flushFrames();
    expect(collapsed()).toEqual(["cand-1", "face-en"]);
    expect(scrolls).toEqual([]);

    rerender({ detail: detailWith(), face: "face-jp" });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toEqual([{ target: "face-jp", block: "center" }]);
  });

  it("does not refocus while the param stays the same", () => {
    const detail = detailWith();
    const { rerender } = renderFocus({ detail, face: "face-jp" });
    flushFrames();
    act(() => useAdminCardFoldStore.getState().togglePrinting(CARD, "face-en"));

    rerender({ detail, face: "face-jp" });
    rerender({ detail: detailWith(), face: "face-jp" });
    flushFrames();

    expect(openKeys()).toEqual(["face-en", "face-jp"]);
    expect(scrolls).toHaveLength(1);
  });

  it("refocuses after the param is cleared and set again", () => {
    const detail = detailWith();
    const { rerender } = renderFocus({ detail, face: "face-jp" });
    act(() => useAdminCardFoldStore.getState().setCollapsedForCard(CARD, new Set()));

    rerender({ detail });
    rerender({ detail, face: "face-jp" });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toHaveLength(2);
  });

  it("moves to a different face when the param changes", () => {
    const detail = detailWith();
    const { rerender } = renderFocus({ detail, face: "face-jp" });

    rerender({ detail, face: "face-en" });
    flushFrames();

    expect(openKeys()).toEqual(["face-en"]);
    expect(scrolls.map((scroll) => scroll.target)).toEqual(["face-jp", "face-en"]);
  });

  it("does nothing for a face the card does not have", () => {
    renderFocus({ detail: detailWith(), face: "face-unknown" });
    flushFrames();

    expect(collapsed()).toEqual([...ALL_KEYS].toSorted());
    expect(scrolls).toEqual([]);
  });
});

describe("marketplace deep link", () => {
  it("focuses the printing matching finish and language", () => {
    renderFocus({
      detail: detailWith(),
      focusMarketplace: "tcgplayer",
      focusFinish: "foil",
      focusLanguage: "EN",
    });
    flushFrames();

    expect(openKeys()).toEqual(["face-en-foil"]);
    expect(scrolls).toEqual([{ target: "face-en-foil", block: "center" }]);
  });

  it("ignores the language for Cardmarket", () => {
    renderFocus({
      detail: detailWith(),
      focusMarketplace: "cardmarket",
      focusFinish: "foil",
      focusLanguage: "EN",
    });

    expect(openKeys()).toEqual(["face-jp"]);
  });

  it("matches any language when the language param is empty", () => {
    renderFocus({
      detail: detailWith(),
      focusMarketplace: "tcgplayer",
      focusFinish: "foil",
      focusLanguage: "",
    });

    expect(openKeys()).toEqual(["face-jp"]);
  });

  it("falls back to the first printing with the finish when no language matches", () => {
    renderFocus({
      detail: detailWith(),
      focusMarketplace: "cardtrader",
      focusFinish: "foil",
      focusLanguage: "ZH",
    });

    expect(openKeys()).toEqual(["face-jp"]);
  });

  it("needs both a marketplace and a finish", () => {
    const { rerender } = renderFocus({ detail: detailWith(), focusMarketplace: "tcgplayer" });
    rerender({ detail: detailWith(), focusFinish: "foil" });
    flushFrames();

    expect(collapsed()).toEqual([...ALL_KEYS].toSorted());
    expect(scrolls).toEqual([]);
  });

  it("waits for a refetch that brings a printing with the finish", () => {
    const params = { focusMarketplace: "tcgplayer", focusFinish: "foil" } as const;
    const { rerender } = renderFocus({
      detail: detailWith({ printings: [enNonfoil] }),
      ...params,
    });
    flushFrames();
    expect(scrolls).toEqual([]);

    rerender({ detail: detailWith(), ...params });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toHaveLength(1);
  });

  it("focuses at most once per page visit, even when the params change", () => {
    const detail = detailWith();
    const { rerender } = renderFocus({
      detail,
      focusMarketplace: "tcgplayer",
      focusFinish: "foil",
      focusLanguage: "EN",
    });

    rerender({ detail });
    rerender({ detail, focusMarketplace: "tcgplayer", focusFinish: "nonfoil" });
    flushFrames();

    expect(openKeys()).toEqual(["face-en-foil"]);
    expect(scrolls).toHaveLength(1);
  });
});

describe("attention deep link", () => {
  function decisionsFolded(): boolean {
    return getCollapsedSections(useAdminCardFoldStore.getState()).has("attention");
  }

  it("opens a folded Needs a decision section and scrolls it to the top", () => {
    act(() => useAdminCardFoldStore.getState().toggleSection("attention"));

    renderFocus({ detail: detailWith(), section: "attention" });

    expect(decisionsFolded()).toBe(false);
    expect(scrolls).toEqual([]);
    flushFrames();
    expect(scrolls).toEqual([{ target: "#needs-decision", block: "start" }]);
  });

  it("keeps an open section open", () => {
    renderFocus({ detail: detailWith(), section: "attention" });
    flushFrames();

    expect(decisionsFolded()).toBe(false);
    expect(scrolls).toHaveLength(1);
  });

  it("does not touch the printing folds", () => {
    renderFocus({ detail: detailWith(), section: "attention" });

    expect(collapsed()).toEqual([...ALL_KEYS].toSorted());
  });

  it("waits for the detail", () => {
    const { rerender } = renderFocus({ section: "attention" });
    flushFrames();
    expect(scrolls).toEqual([]);

    rerender({ detail: detailWith(), section: "attention" });
    flushFrames();

    expect(scrolls).toHaveLength(1);
  });

  it("scrolls once per visit to the section and again after leaving it", () => {
    const detail = detailWith();
    const { rerender } = renderFocus({ detail, section: "attention" });
    act(() => useAdminCardFoldStore.getState().toggleSection("attention"));
    rerender({ detail: detailWith(), section: "attention" });
    flushFrames();
    expect(scrolls).toHaveLength(1);
    expect(decisionsFolded()).toBe(true);

    rerender({ detail, section: "printings" });
    rerender({ detail, section: "attention" });
    flushFrames();

    expect(scrolls).toHaveLength(2);
    expect(decisionsFolded()).toBe(false);
  });
});

describe("accepted printing", () => {
  const accepted = makeAdminPrinting({ id: "p-new", faceId: "face-new", finish: "nonfoil" });

  it("focuses at once when the detail already has the printing", () => {
    const { result } = renderFocus({ detail: detailWith() });

    act(() => result.current.focusAcceptedPrinting("p-jp-foil"));
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toEqual([{ target: "face-jp", block: "center" }]);
  });

  it("focuses again when the same printing is accepted twice", () => {
    const detail = detailWith();
    const { result, rerender } = renderFocus({ detail });

    act(() => result.current.focusAcceptedPrinting("p-jp-foil"));
    act(() => useAdminCardFoldStore.getState().setCollapsedForCard(CARD, new Set()));
    act(() => result.current.focusAcceptedPrinting("p-jp-foil"));
    rerender({ detail });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls).toHaveLength(2);
  });

  it("focuses the new printing's face once the refetched detail has it", () => {
    const node = document.createElement("div");
    node.dataset.faceId = "face-new";
    document.body.append(node);
    const before = detailWith();
    const { result, rerender } = renderFocus({ detail: before });

    act(() => result.current.focusAcceptedPrinting("p-new"));
    rerender({ detail: before });
    flushFrames();
    expect(scrolls).toEqual([]);

    const after = detailWith({ printings: [enNonfoil, jpFoil, enFoil, accepted] });
    rerender({ detail: after });
    flushFrames();

    const folds = new Set(collapsed());
    expect(folds.has("face-new")).toBe(false);
    expect(folds.has("face-en")).toBe(true);
    expect(scrolls).toEqual([{ target: "face-new", block: "center" }]);

    rerender({ detail: detailWith({ printings: [enNonfoil, jpFoil, enFoil, accepted] }) });
    flushFrames();
    expect(scrolls).toHaveLength(1);
  });
});

describe("revealPrinting", () => {
  it("opens the printing's faces, switches to Faces and scrolls once navigation settles", async () => {
    let settle: () => void = () => {};
    goToSection.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );
    const { result } = renderFocus({ detail: detailWith() });

    act(() => result.current.revealPrinting("p-jp-foil"));

    expect(openKeys()).toEqual(["face-jp"]);
    expect(goToSection).toHaveBeenCalledWith("printings");
    flushFrames();
    expect(scrolls).toEqual([]);

    await act(async () => {
      settle();
      await Promise.resolve();
    });
    flushFrames();
    expect(scrolls).toEqual([{ target: "face-jp", block: "center" }]);
  });

  it("folds everything for an unknown printing and still switches to Faces", async () => {
    useAdminCardFoldStore.getState().setCollapsedForCard(CARD, new Set());
    const { result } = renderFocus({ detail: detailWith() });

    await act(async () => {
      result.current.revealPrinting("p-unknown");
      await Promise.resolve();
    });
    flushFrames();

    expect(openKeys()).toEqual([]);
    expect(goToSection).toHaveBeenCalledWith("printings");
    expect(scrolls).toEqual([]);
  });

  it("does nothing before the detail loads", () => {
    const { result } = renderFocus({});

    act(() => result.current.revealPrinting("p-jp-foil"));

    expect(goToSection).not.toHaveBeenCalled();
    expect(collapsed()).toBeUndefined();
  });
});

describe("revealNewPrinting", () => {
  it("opens only the candidate's group, switches to Faces and scrolls the group", async () => {
    const { result } = renderFocus({ detail: detailWith() });

    await act(async () => {
      result.current.revealNewPrinting("cand-1");
      await Promise.resolve();
    });
    flushFrames();

    expect(openKeys()).toEqual(["cand-1"]);
    expect(goToSection).toHaveBeenCalledWith("printings");
    expect(scrolls).toEqual([{ target: "cand-1", block: "center" }]);
  });

  it("does nothing for a candidate in no group", () => {
    const { result } = renderFocus({ detail: detailWith() });

    act(() => result.current.revealNewPrinting("cand-unknown"));

    expect(goToSection).not.toHaveBeenCalled();
    expect(collapsed()).toEqual([...ALL_KEYS].toSorted());
  });
});

describe("several deep links at once", () => {
  it("lets the marketplace focus win the folds and scrolls the face first", () => {
    renderFocus({
      detail: detailWith(),
      face: "face-en",
      focusMarketplace: "tcgplayer",
      focusFinish: "foil",
      focusLanguage: "JP",
    });
    flushFrames();

    expect(openKeys()).toEqual(["face-jp"]);
    expect(scrolls.map((scroll) => scroll.target)).toEqual(["face-en", "face-jp"]);
  });
});
