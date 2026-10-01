import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    hash,
    children,
    className,
  }: {
    to: string;
    params?: Record<string, string>;
    hash?: string;
    children: ReactNode;
    className?: string;
  }) => {
    let path = to;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`$${key}`, value);
      }
    }
    return (
      <a href={hash ? `${path}#${hash}` : path} className={className} data-testid="router-link">
        {children}
      </a>
    );
  },
  createLink: (Component: unknown) => Component,
}));

const { InlineDiff, handleRuleHtmlClick } = await import("./rule-content");

function RuleHtml({ html, navigate }: { html: string; navigate?: (href: string) => void }) {
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mirrors the rules page delegation
    <div onClick={(event) => handleRuleHtmlClick(event, navigate ?? vi.fn())}>
      {/* oxlint-disable-next-line react/no-danger -- test fixture */}
      <div className="rule-html" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const RULE_540_LINK = 'See <a href="#rule-540">rule 540</a> for details.';

describe("InlineDiff", () => {
  it("marks a replaced word and keeps the rest plain", () => {
    const { container } = render(<InlineDiff oldText="the cat sat" newText="the dog sat" />);
    expect(container.querySelector("span.line-through")).toHaveTextContent("cat");
    expect(container.querySelector("mark")).toHaveTextContent("dog");
    expect(container.textContent).toBe("the cat dog sat");
  });

  it("renders emphasis and rule links from the new version without mangling", () => {
    const { container } = render(
      <InlineDiff
        oldText={"matches your *Champion Legend.*\nSee rule 540."}
        newText={"matches your *Champion Legend. Example:*\nSee rule 540."}
      />,
    );
    expect(container.textContent).not.toContain("*");
    expect(container.querySelector("em")).toHaveTextContent("Champion Legend. Example:");
    const link = screen.getByRole("link", { name: "rule 540" });
    expect(link).toHaveAttribute("href", "#rule-540");
  });

  it("renders a penalty badge inside an added segment", () => {
    const { container } = render(
      <InlineDiff oldText="Penalty: none." newText="Penalty: [Game Loss] none." />,
    );
    const badge = [...container.querySelectorAll("span")].find((span) =>
      span.className.includes("font-semibold"),
    );
    expect(badge).toHaveTextContent("[Game Loss]");
    expect(badge?.querySelector("mark")).not.toBeNull();
  });

  it("shows no marks for a whitespace-only rewrap", () => {
    const { container } = render(
      <InlineDiff oldText={"first line\nsecond line"} newText="first line second line" />,
    );
    expect(container.querySelector("mark")).toBeNull();
    expect(container.querySelector("span.line-through")).toBeNull();
  });
});

describe("same-page anchor click handler", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useRulesSearchStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("clears the search when the target rule is not in the DOM", () => {
    useRulesSearchStore.getState().setQuery("trigger");
    render(<RuleHtml html={RULE_540_LINK} />);

    const link = screen.getByRole("link", { name: "rule 540" });
    fireEvent.click(link);

    expect(useRulesSearchStore.getState().query).toBe("");
    expect(useRulesSearchStore.getState().resetSignal).toBe(1);
  });

  it("leaves the search untouched when the target rule is in the DOM", () => {
    useRulesSearchStore.getState().setQuery("trigger");
    const target = document.createElement("div");
    target.id = "rule-540";
    document.body.append(target);

    render(<RuleHtml html={RULE_540_LINK} />);
    const link = screen.getByRole("link", { name: "rule 540" });
    fireEvent.click(link);

    expect(useRulesSearchStore.getState().query).toBe("trigger");
    expect(useRulesSearchStore.getState().resetSignal).toBe(0);
    target.remove();
  });

  it("pushes a history entry (not replace) so browser back returns to origin", () => {
    const unsubscribe = useRulesSearchStore.subscribe((state, prev) => {
      if (state.resetSignal !== prev.resetSignal) {
        const target = document.createElement("div");
        target.id = "rule-540";
        target.scrollIntoView = vi.fn();
        document.body.append(target);
      }
    });
    const pushSpy = vi.spyOn(globalThis.history, "pushState");
    const replaceSpy = vi.spyOn(globalThis.history, "replaceState");
    useRulesSearchStore.getState().setQuery("trigger");

    render(<RuleHtml html={RULE_540_LINK} />);
    fireEvent.click(screen.getByRole("link", { name: "rule 540" }));

    expect(pushSpy).toHaveBeenCalledWith(null, "", "#rule-540");
    expect(replaceSpy).not.toHaveBeenCalled();

    unsubscribe();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
    document.querySelector("#rule-540")?.remove();
  });
});

describe("delegated rule link clicks", () => {
  it("routes a site link through the router", () => {
    const navigate = vi.fn();
    render(<RuleHtml html='Plays <a href="/cards/flash">Flash</a>.' navigate={navigate} />);

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    screen.getByRole("link", { name: "Flash" }).dispatchEvent(event);

    expect(navigate).toHaveBeenCalledWith("/cards/flash");
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a modified click to the browser", () => {
    const navigate = vi.fn();
    render(<RuleHtml html='Plays <a href="/cards/flash">Flash</a>.' navigate={navigate} />);

    fireEvent.click(screen.getByRole("link", { name: "Flash" }), { ctrlKey: true });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves an external link to the browser", () => {
    const navigate = vi.fn();
    render(
      <RuleHtml
        html='<a href="https://example.com" target="_blank" rel="noreferrer">PDF</a>'
        navigate={navigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "PDF" }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it("ignores links outside the rule HTML", () => {
    const navigate = vi.fn();
    render(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- test fixture
      <div onClick={(event) => handleRuleHtmlClick(event, navigate)}>
        <a href="/cards/flash">Flash</a>
      </div>,
    );

    fireEvent.click(screen.getByRole("link", { name: "Flash" }));

    expect(navigate).not.toHaveBeenCalled();
  });
});
