import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePageTocStore } from "@/stores/page-toc-store";
import { createStoreResetter } from "@/test/store-helpers";

import { PageToc, PageTocMobileTrigger } from "./page-toc";

const ITEMS = [
  { id: "rule-100", label: "100. Game Concepts", level: 0 },
  { id: "rule-100-1", label: "100.1 Players", level: 1 },
  { id: "rule-200", label: "200. Parts of a Card", level: 0 },
];

let resetStore: () => void;

beforeEach(() => {
  resetStore = createStoreResetter(usePageTocStore);
  for (const item of ITEMS) {
    const heading = document.createElement("div");
    heading.id = item.id;
    document.body.append(heading);
  }
});

afterEach(() => {
  resetStore();
  for (const item of ITEMS) {
    document.querySelector(`#${item.id}`)?.remove();
  }
});

describe("PageTocMobileTrigger", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<PageTocMobileTrigger items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is icon-only without a label class", () => {
    render(<PageTocMobileTrigger items={ITEMS} />);
    expect(screen.queryByText("Contents")).not.toBeInTheDocument();
  });

  it("renders a visible label with the given classes", () => {
    render(<PageTocMobileTrigger items={ITEMS} labelClassName="hidden @2xl:inline" />);
    expect(screen.getByText("Contents")).toHaveClass("hidden", "@2xl:inline");
    expect(screen.getByRole("button", { name: "Open contents" })).toBeInTheDocument();
  });

  it("opens the drawer and shows all items", async () => {
    const user = userEvent.setup();
    render(<PageTocMobileTrigger items={ITEMS} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));

    for (const item of ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toBeInTheDocument();
    }
  });

  it("scrolls to target, updates active id, and closes the drawer on item click", async () => {
    const user = userEvent.setup();
    const scrollSpy = vi
      .spyOn(globalThis.Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    render(<PageTocMobileTrigger items={ITEMS} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));
    await user.click(screen.getByRole("link", { name: "100.1 Players" }));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(usePageTocStore.getState().activeId).toBe("rule-100-1");
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "100.1 Players" })).not.toBeInTheDocument();
    });

    scrollSpy.mockRestore();
  });

  it("highlights the active item driven by the store", async () => {
    const user = userEvent.setup();
    usePageTocStore.getState().setActiveId("rule-200");
    render(<PageTocMobileTrigger items={ITEMS} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));

    expect(screen.getByRole("link", { name: "200. Parts of a Card" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("link", { name: "100. Game Concepts" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

describe("PageToc", () => {
  const nativeIntersectionObserver = globalThis.IntersectionObserver;
  let rootMargins: string[] = [];
  let observerCallback: IntersectionObserverCallback | undefined;

  beforeEach(() => {
    rootMargins = [];
    observerCallback = undefined;
    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        rootMargins.push(options?.rootMargin ?? "");
        observerCallback = callback;
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = nativeIntersectionObserver;
    document.querySelector("header[data-app-header]")?.remove();
    vi.restoreAllMocks();
  });

  function placeSection(id: string, top: number) {
    const element = document.querySelector<HTMLElement>(`#${id}`);
    if (element) {
      element.getBoundingClientRect = () => ({ top }) as DOMRect;
    }
  }

  /** The fallback header height is 57px, so the observed band starts there. */
  function reportIntersections(changes: Record<string, boolean>) {
    const entries = Object.entries(changes).map(([id, isIntersecting]) => ({
      target: document.querySelector(`#${id}`),
      isIntersecting,
    }));
    act(() => {
      observerCallback?.(
        entries as unknown as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });
  }

  function linkFor(label: string) {
    return screen.getByRole("link", { name: label });
  }

  function makePageScrollable() {
    const scroller = document.scrollingElement ?? document.documentElement;
    vi.spyOn(scroller, "scrollHeight", "get").mockReturnValue(5000);
    vi.spyOn(scroller, "clientHeight", "get").mockReturnValue(800);
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
  }

  function withoutScrollEnd(run: () => Promise<void>) {
    let owner: object | null = globalThis;
    while (owner && !Object.hasOwn(owner, "onscrollend")) {
      owner = Object.getPrototypeOf(owner) as object | null;
    }
    const descriptor = owner ? Object.getOwnPropertyDescriptor(owner, "onscrollend") : undefined;
    if (owner && descriptor) {
      Reflect.deleteProperty(owner, "onscrollend");
    }
    return run().finally(() => {
      if (owner && descriptor) {
        Object.defineProperty(owner, "onscrollend", descriptor);
      }
    });
  }

  it("holds a clicked entry through observer callbacks until the scroll ends", async () => {
    const user = userEvent.setup();
    makePageScrollable();
    placeSection("rule-100", 100);
    placeSection("rule-100-1", 300);
    placeSection("rule-200", 900);
    render(<PageToc items={ITEMS} />);

    await user.click(linkFor("200. Parts of a Card"));
    reportIntersections({ "rule-100": true, "rule-100-1": true });

    expect(linkFor("200. Parts of a Card")).toHaveAttribute("aria-current", "location");

    act(() => {
      document.dispatchEvent(new Event("scrollend"));
    });
    expect(linkFor("200. Parts of a Card")).toHaveAttribute("aria-current", "location");

    reportIntersections({ "rule-100-1": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("releases the hold when a nested scroller ends its scroll", async () => {
    const user = userEvent.setup();
    makePageScrollable();
    placeSection("rule-100", 100);
    placeSection("rule-200", 900);
    render(<PageToc items={ITEMS} />);

    await user.click(linkFor("200. Parts of a Card"));
    act(() => {
      document.querySelector("#rule-200")?.dispatchEvent(new Event("scrollend"));
    });
    reportIntersections({ "rule-100": true });

    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("holds an entry the page jumps to until the scroll ends", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    placeSection("rule-100", 100);
    const hidden = document.querySelector("#rule-100-1");
    if (hidden) {
      hidden.getClientRects = () => [] as unknown as DOMRectList;
    }
    render(<PageToc items={ITEMS} onJump={vi.fn()} />);

    await user.click(linkFor("100.1 Players"));
    reportIntersections({ "rule-100": true });
    expect(linkFor("100.1 Players")).toHaveAttribute("aria-current", "location");

    act(() => {
      document.dispatchEvent(new Event("scrollend"));
    });
    reportIntersections({ "rule-100": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("releases the hold when the page's jump renders the entry in place", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    placeSection("rule-100", 100);
    placeSection("rule-100-1", 0);
    const hidden = document.querySelector("#rule-100-1");
    if (hidden) {
      hidden.getClientRects = () => [] as unknown as DOMRectList;
    }
    render(<PageToc items={ITEMS} onJump={() => Promise.resolve()} />);

    await user.click(linkFor("100.1 Players"));
    reportIntersections({ "rule-100": true });

    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("keeps holding an entry the page's jump still has to scroll to", async () => {
    const user = userEvent.setup();
    makePageScrollable();
    placeSection("rule-100", 100);
    placeSection("rule-100-1", 900);
    const hidden = document.querySelector("#rule-100-1");
    if (hidden) {
      hidden.getClientRects = () => [] as unknown as DOMRectList;
    }
    render(<PageToc items={ITEMS} onJump={() => Promise.resolve()} />);

    await user.click(linkFor("100.1 Players"));
    reportIntersections({ "rule-100": true });
    expect(linkFor("100.1 Players")).toHaveAttribute("aria-current", "location");

    act(() => {
      document.dispatchEvent(new Event("scrollend"));
    });
    reportIntersections({ "rule-100": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("lets the observer move a clicked entry where scrollend is not supported", async () => {
    await withoutScrollEnd(async () => {
      const user = userEvent.setup();
      makePageScrollable();
      placeSection("rule-100", 100);
      placeSection("rule-200", 900);
      render(<PageToc items={ITEMS} />);

      await user.click(linkFor("200. Parts of a Card"));
      expect(linkFor("200. Parts of a Card")).toHaveAttribute("aria-current", "location");

      reportIntersections({ "rule-100": true });
      expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
    });
  });

  it("does not hold a clicked entry that needs no scrolling", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    placeSection("rule-100", 100);
    placeSection("rule-200", 0);
    render(<PageToc items={ITEMS} />);

    await user.click(linkFor("200. Parts of a Card"));
    expect(linkFor("200. Parts of a Card")).toHaveAttribute("aria-current", "location");

    reportIntersections({ "rule-100": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("picks the active section from every intersecting section seen so far", () => {
    placeSection("rule-100", 80);
    placeSection("rule-100-1", 200);
    placeSection("rule-200", 600);
    render(<PageToc items={ITEMS} />);

    reportIntersections({ "rule-100": true, "rule-100-1": false, "rule-200": false });
    reportIntersections({ "rule-100-1": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");

    reportIntersections({ "rule-100": false });
    expect(linkFor("100.1 Players")).toHaveAttribute("aria-current", "location");
  });

  it("picks the deepest section covering the band when no section starts inside it", () => {
    placeSection("rule-100", -400);
    placeSection("rule-100-1", -100);
    placeSection("rule-200", 900);
    render(<PageToc items={ITEMS} />);

    reportIntersections({ "rule-100": true, "rule-100-1": true });
    expect(linkFor("100.1 Players")).toHaveAttribute("aria-current", "location");
  });

  it("clears the live header height when picking the active heading", () => {
    const header = document.createElement("header");
    header.dataset.appHeader = "";
    header.getBoundingClientRect = () => ({ height: 64 }) as DOMRect;
    document.body.append(header);

    render(<PageToc items={ITEMS} />);

    expect(rootMargins.at(-1)).toBe("-64px 0px -60% 0px");
  });

  it("highlights the first item while the active id belongs to another page", () => {
    usePageTocStore.getState().setActiveId("glossary-keywords");
    render(<PageToc items={ITEMS} />);

    expect(screen.getByRole("link", { name: "100. Game Concepts" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  it("hands a jump to a hidden heading to the page", async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    const scrollSpy = vi
      .spyOn(globalThis.Element.prototype, "scrollIntoView")
      .mockImplementation(() => {});
    const hidden = document.querySelector("#rule-100-1");
    if (hidden) {
      hidden.getClientRects = () => [] as unknown as DOMRectList;
    }
    render(<PageToc items={ITEMS} onJump={onJump} />);

    await user.click(screen.getByRole("link", { name: "100.1 Players" }));

    expect(onJump).toHaveBeenCalledWith("rule-100-1");
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
