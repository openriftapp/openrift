import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MetaScopeEmpty } from "./meta-scope-empty";

const eras = [
  { id: "set-b", label: "Set B", from: "2026-06-01", to: null },
  { id: "set-a", label: "Set A", from: "2026-01-01", to: "2026-05-31" },
];

function setup(scope: { era?: string }) {
  const setScope = vi.fn();
  render(<MetaScopeEmpty scope={scope} eras={eras} setScope={setScope} fallback="Nothing here." />);
  return setScope;
}

describe("MetaScopeEmpty", () => {
  it("names the default era and offers both actions", () => {
    setup({});
    expect(screen.getByText("Set B has no results on file yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all eras" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick an era" })).toBeInTheDocument();
  });

  it("switches to all eras", async () => {
    const setScope = setup({ era: "set-a" });
    expect(screen.getByText("Set A has no results on file yet.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show all eras" }));
    expect(setScope).toHaveBeenCalledWith({ era: "all", from: undefined, to: undefined });
  });

  it("opens the era list and picks one", async () => {
    const setScope = setup({});
    await userEvent.click(screen.getByRole("button", { name: "Pick an era" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Set A" }));
    expect(setScope).toHaveBeenCalledWith({ era: "set-a", from: undefined, to: undefined });
  });

  it("keeps the plain sentence when the scope is all time", () => {
    setup({ era: "all" });
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show all eras" })).toBeNull();
  });
});
