import { withReferralCode } from "@openrift/shared/referral";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let referralCode: string | null = null;

vi.mock("@/features/account/hooks/use-referral", () => ({
  useReferralUrl: (url: string | null) =>
    url === null ? null : withReferralCode(url, referralCode),
}));

const { SharePanel } = await import("./share-panel");

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
  beforeEach(() => {
    referralCode = null;
  });

  it("carries the viewer's invite code on the shared link but not on their own Open link", () => {
    referralCode = "Inv1te0Code9";
    renderPanel(URL);
    expect(screen.getByRole("textbox", { name: "Profile link" })).toHaveValue(
      `${URL}#r=Inv1te0Code9`,
    );
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", URL);
  });

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

  it("shows only the caller's actions and the unfurl note for a link that cannot be stopped", () => {
    render(
      <SharePanel
        noun="card"
        link={{
          url: "https://openrift.app/cards/blazing-scorcher/ogn-001-en",
          label: "Share link",
          unfurls: true,
          actions: <span>native share</span>,
        }}
        qrFilename={{ base: "ogn-001-en", fallback: "card" }}
      />,
    );
    expect(screen.getByText("native share")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stop sharing" })).not.toBeInTheDocument();
    expect(screen.getByText(/shows a preview image/u)).toBeInTheDocument();
    expect(screen.queryByText(/Anyone with this link/u)).not.toBeInTheDocument();
  });
});
