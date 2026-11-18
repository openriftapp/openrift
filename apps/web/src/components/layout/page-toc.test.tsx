import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PageTocStore } from "@/stores/page-toc-store";
import { createPageTocStore, PageTocStoreContext } from "@/stores/page-toc-store";

import { PageToc, PageTocMobileTrigger, PageTocProvider } from "./page-toc";

const ITEMS = [
  { id: "rule-100", label: "100. Game Concepts", level: 0 },
  { id: "rule-100-1", label: "100.1 Players", level: 1 },
  { id: "rule-200", label: "200. Parts of a Card", level: 0 },
];

let store: PageTocStore;

function renderToc(ui: ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <PageTocStoreContext value={store}>{children}</PageTocStoreContext>
    ),
  });
}

beforeEach(() => {
  store = createPageTocStore();
  for (const item of ITEMS) {
    const heading = document.createElement("div");
    heading.id = item.id;
    document.body.append(heading);
  }
});

afterEach(() => {
  for (const item of ITEMS) {
    document.querySelector(`#${item.id}`)?.remove();
  }
});

describe("PageTocMobileTrigger", () => {
  it("renders nothing when items is empty", () => {
    const { container } = renderToc(<PageTocMobileTrigger items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is icon-only without a label class", () => {
    renderToc(<PageTocMobileTrigger items={ITEMS} />);
    expect(screen.queryByText("Contents")).not.toBeInTheDocument();
  });

  it("renders a visible label with the given classes", () => {
    renderToc(<PageTocMobileTrigger items={ITEMS} labelClassName="hidden @2xl:inline" />);
    expect(screen.getByText("Contents")).toHaveClass("hidden", "@2xl:inline");
    expect(screen.getByRole("button", { name: "Open contents" })).toBeInTheDocument();
  });

  it("opens the drawer and shows all items", async () => {
    const user = userEvent.setup();
    renderToc(<PageTocMobileTrigger items={ITEMS} />);

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
    renderToc(<PageTocMobileTrigger items={ITEMS} />);

    await user.click(screen.getByRole("button", { name: "Open contents" }));
    await user.click(screen.getByRole("link", { name: "100.1 Players" }));

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().activeId).toBe("rule-100-1");
    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "100.1 Players" })).not.toBeInTheDocument();
    });

    scrollSpy.mockRestore();
  });

  it("highlights the active item driven by the store", async () => {
    const user = userEvent.setup();
    store.getState().setActiveId("rule-200");
    renderToc(<PageTocMobileTrigger items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} onJump={vi.fn()} />);

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
    renderToc(<PageToc items={ITEMS} onJump={() => Promise.resolve()} />);

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
    renderToc(<PageToc items={ITEMS} onJump={() => Promise.resolve()} />);

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
      renderToc(<PageToc items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} />);

    await user.click(linkFor("200. Parts of a Card"));
    expect(linkFor("200. Parts of a Card")).toHaveAttribute("aria-current", "location");

    reportIntersections({ "rule-100": true });
    expect(linkFor("100. Game Concepts")).toHaveAttribute("aria-current", "location");
  });

  it("picks the active section from every intersecting section seen so far", () => {
    placeSection("rule-100", 80);
    placeSection("rule-100-1", 200);
    placeSection("rule-200", 600);
    renderToc(<PageToc items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} />);

    reportIntersections({ "rule-100": true, "rule-100-1": true });
    expect(linkFor("100.1 Players")).toHaveAttribute("aria-current", "location");
  });

  it("clears the live header height when picking the active heading", () => {
    const header = document.createElement("header");
    header.dataset.appHeader = "";
    header.getBoundingClientRect = () => ({ height: 64 }) as DOMRect;
    document.body.append(header);

    renderToc(<PageToc items={ITEMS} />);

    expect(rootMargins.at(-1)).toBe("-64px 0px -60% 0px");
  });

  it("highlights the first item while the active id is not among the items", () => {
    store.getState().setActiveId("glossary-keywords");
    renderToc(<PageToc items={ITEMS} />);

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
    renderToc(<PageToc items={ITEMS} onJump={onJump} />);

    await user.click(screen.getByRole("link", { name: "100.1 Players" }));

    expect(onJump).toHaveBeenCalledWith("rule-100-1");
    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});

describe("PageTocProvider", () => {
  const nativeIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = nativeIntersectionObserver;
    vi.restoreAllMocks();
  });

  it("needs a provider around the contents list", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<PageToc items={ITEMS} />)).toThrow(
      "usePageTocStore needs a PageTocProvider",
    );
  });

  it("starts the next page without the previous page's selection", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    const first = render(
      <PageTocProvider>
        <PageToc items={ITEMS} />
      </PageTocProvider>,
    );
    await user.click(screen.getByRole("link", { name: "200. Parts of a Card" }));
    expect(screen.getByRole("link", { name: "200. Parts of a Card" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    first.unmount();

    render(
      <PageTocProvider>
        <PageToc items={ITEMS} />
      </PageTocProvider>,
    );
    expect(screen.getByRole("link", { name: "100. Game Concepts" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  it("keeps the selections of two pages apart", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    render(
      <>
        <PageTocProvider>
          <nav aria-label="first">
            <PageToc items={ITEMS} />
          </nav>
        </PageTocProvider>
        <PageTocProvider>
          <nav aria-label="second">
            <PageToc items={ITEMS} />
          </nav>
        </PageTocProvider>
      </>,
    );

    const linkIn = (page: string) =>
      within(screen.getByRole("navigation", { name: page })).getByRole("link", {
        name: "200. Parts of a Card",
      });
    const firstLink = linkIn("first");
    const secondLink = linkIn("second");
    await user.click(firstLink);

    expect(firstLink).toHaveAttribute("aria-current", "location");
    expect(secondLink).not.toHaveAttribute("aria-current");
  });
});
