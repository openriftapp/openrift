import { render, screen, waitFor } from "@testing-library/react";
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

    const activeLink = screen.getByRole("link", { name: "200. Parts of a Card" });
    expect(activeLink.className).toContain("text-foreground");
    expect(activeLink.className).toContain("font-medium");
  });
});

describe("PageToc", () => {
  const nativeIntersectionObserver = globalThis.IntersectionObserver;
  let rootMargins: string[] = [];

  beforeEach(() => {
    rootMargins = [];
    globalThis.IntersectionObserver = class {
      constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        rootMargins.push(options?.rootMargin ?? "");
      }
      observe() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = nativeIntersectionObserver;
    document.querySelector("header[data-app-header]")?.remove();
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

    expect(screen.getByRole("link", { name: "100. Game Concepts" }).className).toContain(
      "font-medium",
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
