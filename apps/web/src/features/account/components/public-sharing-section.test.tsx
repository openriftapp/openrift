import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const enableMutate = vi.fn();
const disableMutate = vi.fn();

const { shareStateMock } = vi.hoisted(() => ({
  shareStateMock: vi.fn(
    (): { data: { shareToken: string | null } | undefined; isPending: boolean } => ({
      data: { shareToken: null },
      isPending: false,
    }),
  ),
}));

vi.mock("@/features/groups/hooks/use-user-share", () => ({
  useUserShareState: shareStateMock,
  useEnableUserShare: () => ({ mutate: enableMutate, isPending: false }),
  useDisableUserShare: () => ({ mutate: disableMutate, isPending: false }),
}));

vi.mock("@/lib/auth-session", () => ({
  useSession: () => ({ data: { user: { name: "Summoner Kai" } } }),
}));

vi.mock("@/lib/site-config", () => ({
  getSiteUrl: () => "https://openrift.test",
}));

const { PublicSharingSection } = await import("./public-sharing-section");

describe("PublicSharingSection", () => {
  afterEach(() => {
    shareStateMock.mockReset();
    shareStateMock.mockReturnValue({ data: { shareToken: null }, isPending: false });
  });

  it("offers only a Create link before the bundle is shared", () => {
    render(<PublicSharingSection />);
    expect(screen.getByRole("button", { name: /create link/iu })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Image" })).not.toBeInTheDocument();
  });

  it("renders the bundle link and its outputs once shared", () => {
    shareStateMock.mockReturnValue({ data: { shareToken: "AbCdEfGhIjKl" }, isPending: false });
    render(<PublicSharingSection />);

    expect(
      screen.getByDisplayValue("https://openrift.test/users/share/AbCdEfGhIjKl"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Image" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "QR code" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Print" })).toBeInTheDocument();
  });

  it("no longer offers a reset, which Stop sharing then Create link already does", () => {
    shareStateMock.mockReturnValue({ data: { shareToken: "AbCdEfGhIjKl" }, isPending: false });
    render(<PublicSharingSection />);
    expect(screen.queryByRole("button", { name: /reset link/iu })).not.toBeInTheDocument();
  });

  it("confirms before dropping the bundle link", async () => {
    const user = userEvent.setup();
    disableMutate.mockClear();
    shareStateMock.mockReturnValue({ data: { shareToken: "AbCdEfGhIjKl" }, isPending: false });
    render(<PublicSharingSection />);

    await user.click(screen.getByRole("button", { name: /stop sharing/iu }));
    expect(disableMutate).not.toHaveBeenCalled();

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: /stop sharing/iu }));
    expect(disableMutate).toHaveBeenCalled();
  });
});
