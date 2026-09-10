import type { ListIntent } from "@openrift/shared/types/api/list";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type * as ReactRouter from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const shareMutate = vi.fn();
const unshareMutate = vi.fn();

// The dialog links to /profile#sharing; no router is mounted here, so render a
// plain anchor carrying the resolved target. CatchBoundary keeps its real
// implementation so the group-share section's error handling still works.
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return {
    ...actual,
    Link: ({ to, hash, children }: { to: string; hash?: string; children?: ReactNode }) => (
      <a href={hash ? `${to}#${hash}` : to}>{children}</a>
    ),
  };
});

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useShareList: () => ({ mutate: shareMutate, isPending: false }),
  useUnshareList: () => ({ mutate: unshareMutate, isPending: false }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { finishes: { normal: "Normal", foil: "Foil" } } }),
}));

vi.mock("@/lib/site-config", () => ({
  getSiteUrl: () => "https://openrift.test",
}));

const { groupsMock, groupSharesMock } = vi.hoisted(() => ({
  groupsMock: vi.fn(
    (): {
      data: { items: { id: string; slug: string; name: string }[] };
    } => ({ data: { items: [] } }),
  ),
  groupSharesMock: vi.fn((): { data: { items: { groupId: string }[] } } => ({
    data: { items: [] },
  })),
}));

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroups: groupsMock,
}));

vi.mock("@/features/groups/hooks/use-friend-group-sharing", () => ({
  useShareListWithFriendGroup: () => ({ mutate: vi.fn(), isPending: false }),
  useUnshareListFromFriendGroup: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/features/lists/hooks/use-list-group-shares", () => ({
  useListGroupShares: groupSharesMock,
}));

const { ListShareDialog } = await import("./list-share-dialog");

const queryClient = new QueryClient();

function Harness({
  shareToken,
  intent = "wish",
}: {
  shareToken: string | null;
  intent?: ListIntent;
}) {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={queryClient}>
      <ListShareDialog
        listId="abc"
        listName="Holiday Targets"
        kind="card"
        intent={intent}
        tradeDefaults={{ pricePref: null, priceAbsoluteCents: null, tradeType: null }}
        currency={null}
        isPublic={shareToken !== null}
        shareToken={shareToken}
        updatedAt="2026-06-09T00:00:00.000Z"
        entries={[]}
        open={open}
        onOpenChange={setOpen}
      />
    </QueryClientProvider>
  );
}

describe("ListShareDialog", () => {
  afterEach(() => {
    groupsMock.mockReset();
    groupsMock.mockReturnValue({ data: { items: [] } });
    groupSharesMock.mockReset();
    groupSharesMock.mockReturnValue({ data: { items: [] } });
  });

  it("renders 'Create link' when the list is not yet shared", () => {
    render(<Harness shareToken={null} />);
    expect(screen.getByRole("button", { name: /create link/iu })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop sharing/iu })).not.toBeInTheDocument();
  });

  it("triggers useShareList when 'Create link' is clicked", async () => {
    const user = userEvent.setup();
    shareMutate.mockClear();
    render(<Harness shareToken={null} />);
    await user.click(screen.getByRole("button", { name: /create link/iu }));
    expect(shareMutate).toHaveBeenCalledWith("abc");
  });

  it("renders the share URL and a Stop sharing button when shared", () => {
    render(<Harness shareToken="AbCdEfGhIjKl" />);
    const input = screen.getByDisplayValue("https://openrift.test/lists/share/AbCdEfGhIjKl");
    expect(input).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop sharing/iu })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /create link/iu })).not.toBeInTheDocument();
  });

  it("confirms before unsharing, since the old link cannot be brought back", async () => {
    const user = userEvent.setup();
    unshareMutate.mockClear();
    render(<Harness shareToken="AbCdEfGhIjKl" />);

    await user.click(screen.getByRole("button", { name: /stop sharing/iu }));
    expect(unshareMutate).not.toHaveBeenCalled();

    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: /stop sharing/iu }));
    expect(unshareMutate).toHaveBeenCalledWith("abc");
  });

  it("flips the link Copy button label to 'Copied' after clicking", async () => {
    const user = userEvent.setup();
    render(<Harness shareToken="AbCdEfGhIjKl" />);
    await user.click(screen.getByRole("button", { name: /^copy$/iu }));
    expect(screen.getByRole("button", { name: /^copied$/iu })).toBeInTheDocument();
  });

  it("shows the chat text itself, not just a copy button", async () => {
    render(<Harness shareToken="AbCdEfGhIjKl" />);

    expect(await screen.findByDisplayValue(/Holiday Targets \(0 cards\)/u)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy text/iu })).toBeInTheDocument();
  });

  it("says the chat text carries no link until one exists", async () => {
    render(<Harness shareToken={null} />);
    expect(await screen.findByText(/carries no link until you create one/iu)).toBeInTheDocument();
  });

  it("offers the image render on its own tab, off the owner-authenticated route", async () => {
    const user = userEvent.setup();
    render(<Harness shareToken={null} />);

    await user.click(screen.getByRole("tab", { name: /image/iu }));

    expect(await screen.findByRole("button", { name: /download image/iu })).toBeInTheDocument();
    // The preview is the real render, so an unshared list still gets one — it
    // just can't carry a QR until there is a link to encode.
    expect(screen.getByRole("img", { name: /preview/iu })).toHaveAttribute(
      "src",
      expect.stringContaining("/api/v1/lists/abc/image.png"),
    );
    expect(screen.getByText(/needs a share link to point at/iu)).toBeInTheDocument();
  });

  it("points wish and trade lists at the profile's Public sharing section", () => {
    const { rerender } = render(<Harness shareToken={null} intent="wish" />);
    expect(screen.getByRole("link", { name: /public sharing/iu })).toHaveAttribute(
      "href",
      "/profile#sharing",
    );

    rerender(<Harness shareToken={null} intent="trade" />);
    expect(screen.getByRole("link", { name: /public sharing/iu })).toBeInTheDocument();
  });

  it("omits the bundle cross-link for organize lists, which the bundle excludes", () => {
    render(<Harness shareToken={null} intent="organize" />);
    expect(screen.queryByRole("link", { name: /public sharing/iu })).not.toBeInTheDocument();
  });

  it("shows the friend-group visibility controls when the user has groups", () => {
    groupsMock.mockReturnValue({
      data: { items: [{ id: "g1", slug: "allerlei", name: "Allerlei Spielerei" }] },
    });
    render(<Harness shareToken={null} />);
    expect(screen.getByText("Group visibility")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /only me/iu })).toBeInTheDocument();
  });

  it("shows the empty-state hint when the user has no friend groups", () => {
    render(<Harness shareToken={null} />);
    expect(screen.getByText(/not in any friend groups/iu)).toBeInTheDocument();
  });

  it("shows the binder sheet panel on the Print tab once shared", async () => {
    const user = userEvent.setup();
    render(<Harness shareToken="AbCdEfGhIjKl" />);
    await user.click(screen.getByRole("tab", { name: "Print" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Holiday Targets");
    expect(screen.getByRole("button", { name: /create pdf/iu })).toBeInTheDocument();
  });

  it("asks for a share link first on the Print tab before one exists", async () => {
    const user = userEvent.setup();
    render(<Harness shareToken={null} />);
    await user.click(screen.getByRole("tab", { name: "Print" }));
    expect(screen.getByText(/create a share link above first/iu)).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});
