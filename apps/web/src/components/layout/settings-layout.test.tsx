import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SettingsLayout } from "./settings-layout";

const TOC = [
  { id: "general", label: "General" },
  { id: "danger-zone", label: "Danger zone" },
];

function page(scope: string) {
  return (
    <SettingsLayout toc={TOC} scope={scope}>
      <input aria-label="Name" />
      <div id="general" />
      <div id="danger-zone" />
    </SettingsLayout>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsLayout", () => {
  it("starts the contents list fresh for a new scope and leaves the page alone", async () => {
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    const user = userEvent.setup();
    const { rerender } = render(page("summoner-skirmish"));
    await user.type(screen.getByRole("textbox", { name: "Name" }), "Summoner Skirmish");
    await user.click(screen.getByRole("link", { name: "Danger zone" }));
    expect(screen.getByRole("link", { name: "Danger zone" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    rerender(page("bandle-cup"));

    expect(screen.getByRole("link", { name: "General" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("link", { name: "Danger zone" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Summoner Skirmish");
  });

  it("keeps the highlighted item while the scope stays the same", async () => {
    vi.spyOn(globalThis.Element.prototype, "scrollIntoView").mockImplementation(() => {});
    const user = userEvent.setup();
    const { rerender } = render(page("summoner-skirmish"));
    await user.click(screen.getByRole("link", { name: "Danger zone" }));

    rerender(page("summoner-skirmish"));

    expect(screen.getByRole("link", { name: "Danger zone" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });
});
