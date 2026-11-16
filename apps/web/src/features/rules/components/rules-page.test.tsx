import type { RulePageEntry } from "@openrift/shared/types/api/rules";
import type * as ReactQuery from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  search: {} as { q?: string },
  hash: "",
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useSearch: ({ select }: { select: (search: { q?: string }) => unknown }) =>
      select(router.search),
  }),
  useSearch: ({ select }: { select: (search: { q?: string }) => unknown }) => select(router.search),
  useLocation: ({ select }: { select: (location: { hash: string }) => unknown }) =>
    select({ hash: router.hash }),
  useNavigate: () => router.navigate,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  createLink: (Component: unknown) => Component,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useQuery: () => ({ data: undefined }),
}));

vi.mock("@/hooks/use-feature-flags", () => ({ useFeatureEnabled: () => false }));

function rule(
  ruleNumber: string,
  ruleType: RulePageEntry["ruleType"],
  text: string,
): RulePageEntry {
  return {
    id: `id-${ruleNumber}`,
    kind: "core",
    language: "en",
    version: "2026-01-01",
    ruleNumber,
    sortOrder: 0,
    depth: ruleNumber.split(".").length - 1,
    ruleType,
    changeType: "unchanged",
    contentHtml: text,
  };
}

const RULES = [
  rule("100", "title", "Game Concepts"),
  rule("100.1", "text", "Players take turns."),
  rule("200", "title", "Deck Building"),
  rule("200.1", "text", "A deck has forty cards."),
];

vi.mock("@/features/rules/hooks/use-rules", () => ({
  useRulesAtVersion: () => ({ data: { rules: RULES } }),
  useRuleVersions: () => ({
    data: {
      versions: [
        {
          kind: "core",
          language: "en",
          version: "2026-01-01",
          comments: null,
          commentsHtml: null,
          label: null,
          documentVersion: null,
          importedAt: "2026-01-01T00:00:00Z",
          languages: ["en"],
        },
      ],
      languages: ["en"],
    },
  }),
}));

const { RulesPage } = await import("./rules-page");

/** Reads the DOM at layout time, where the router scrolls to the hash. */
function HashScrollProbe({ onLayout }: { onLayout: () => void }) {
  useLayoutEffect(onLayout);
  return null;
}

function renderPage(onLayout: () => void = () => {}) {
  return render(
    <>
      <RulesPage kind="core" version="2026-01-01" />
      <HashScrollProbe onLayout={onLayout} />
    </>,
  );
}

function collapseFirstGroup(): HTMLElement {
  const [toggle] = screen.getAllByRole("button", { name: "Collapse rule group" });
  if (!toggle) {
    throw new Error("no fold toggle rendered");
  }
  return toggle;
}

function targetState(): "missing" | "hidden" | "shown" {
  const target = document.querySelector(`#${CSS.escape(router.hash)}`);
  if (target === null) {
    return "missing";
  }
  return target.closest(".hidden") === null ? "shown" : "hidden";
}

beforeEach(() => {
  router.search = {};
  router.hash = "";
  router.navigate.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("RulesPage hash jumps", () => {
  it("renders the hash target when arriving after a search on an earlier visit", () => {
    router.search = { q: "deck" };
    renderPage().unmount();

    router.search = {};
    router.hash = "rule-100.1";
    let atLayout = "";
    renderPage(() => {
      atLayout = targetState();
    });

    expect(atLayout).toBe("shown");
  });

  it("filters by the URL query in the same render the query arrives", () => {
    router.search = { q: "deck" };
    let atLayout = "";
    renderPage(() => {
      atLayout =
        document.querySelector(String.raw`#rule-100\.1`) === null ? "filtered" : "unfiltered";
    });

    expect(atLayout).toBe("filtered");
  });

  it("shows a rule inside a section folded on an earlier visit", () => {
    renderPage();
    fireEvent.click(collapseFirstGroup());
    expect(document.querySelector(String.raw`#rule-100\.1`)?.closest(".hidden")).not.toBeNull();
    document.body.innerHTML = "";

    router.hash = "rule-100.1";
    let atLayout = "";
    renderPage(() => {
      atLayout = targetState();
    });

    expect(atLayout).toBe("shown");
  });

  it("unfolds the ancestors of a later hash target before layout", () => {
    const view = renderPage();
    fireEvent.click(collapseFirstGroup());

    router.hash = "rule-100.1";
    let atLayout = "";
    view.rerender(
      <>
        <RulesPage kind="core" version="2026-01-01" />
        <HashScrollProbe
          onLayout={() => {
            atLayout = targetState();
          }}
        />
      </>,
    );

    expect(atLayout).toBe("shown");
  });

  it("keeps a section folded when it is folded under the current hash", () => {
    router.hash = "rule-100.1";
    renderPage();

    fireEvent.click(collapseFirstGroup());

    expect(targetState()).toBe("hidden");
  });

  it("drops the search when a link targets a rule the search filters out", () => {
    router.search = { q: "deck" };
    RULES[3] = rule("200.1", "text", 'A deck follows <a href="#rule-100.1">rule 100.1</a>.');
    renderPage();

    fireEvent.click(screen.getByRole("link", { name: "rule 100.1" }));

    const options = router.navigate.mock.calls[0]?.[0] as {
      hash: string;
      search: (prev: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(options.hash).toBe("rule-100.1");
    expect(options.search({ q: "deck", lang: "en" })).toEqual({ q: undefined, lang: "en" });
    RULES[3] = rule("200.1", "text", "A deck has forty cards.");
  });
});
