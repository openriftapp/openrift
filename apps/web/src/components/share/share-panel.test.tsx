import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SharePanel } from "./share-panel";

const URL = "https://openrift.app/users/share/AbCdEf123456";

function renderPanel(url: string | null) {
  render(
    <SharePanel
      noun="lists"
      link={{
        url,
        label: "Profile link",
        exposes: "see your profile",
        onCreate: vi.fn(),
        onStop: vi.fn(),
      }}
    />,
  );
}

describe("SharePanel", () => {
  it("opens an active share link in a new tab", () => {
    renderPanel(URL);
    const open = screen.getByRole("link", { name: "Open" });
    expect(open).toHaveAttribute("href", URL);
    expect(open).toHaveAttribute("target", "_blank");
  });

  it("offers no open link before a link exists", () => {
    renderPanel(null);
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
  });
});
