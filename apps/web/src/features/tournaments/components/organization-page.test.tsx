import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrganizationPage } from "./organization-page";

const { addMutateAsync, removeMutateAsync } = vi.hoisted(() => ({
  addMutateAsync: vi.fn((): Promise<unknown> => Promise.resolve()),
  removeMutateAsync: vi.fn((): Promise<unknown> => Promise.resolve()),
}));

vi.mock("@/features/tournaments/hooks/use-organizations", () => ({
  useOrganization: () => ({
    data: {
      id: "org-1",
      slug: "lgs-store",
      name: "LGS Store",
      description: null,
      ownerUserId: "owner-1",
      createdAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      viewerRole: "manager",
      members: [
        {
          userId: "member-1",
          name: "Bob Manager",
          role: "manager",
          joinedAt: "2026-06-01T10:00:00.000Z",
        },
      ],
    },
  }),
  useAddOrganizationMember: () => ({ mutateAsync: addMutateAsync, isPending: false }),
  useRemoveOrganizationMember: () => ({ mutateAsync: removeMutateAsync, isPending: false }),
  useUpdateOrganizationMemberRole: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Pulls in deck-check server wiring; stub it so the page renders in isolation.
vi.mock("@/features/tournaments/components/deck-check-keys-section", () => ({
  OrgDeckCheckKeysSection: () => <div>keys-section</div>,
}));

describe("OrganizationPage member removal", () => {
  beforeEach(() => {
    removeMutateAsync.mockClear();
  });

  it("opens a confirmation instead of removing the member immediately", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage id="org-1" />);

    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(removeMutateAsync).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Remove member");
  });

  it("removes the member only after the confirmation is accepted", async () => {
    const user = userEvent.setup();
    render(<OrganizationPage id="org-1" />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeMutateAsync).toHaveBeenCalledWith({ id: "org-1", userId: "member-1" });
  });

  it("keeps the confirmation open when the removal is rejected", async () => {
    removeMutateAsync.mockRejectedValueOnce(new Error("forbidden"));
    const user = userEvent.setup();
    render(<OrganizationPage id="org-1" />);

    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(removeMutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("OrganizationPage add member", () => {
  beforeEach(() => {
    addMutateAsync.mockReset();
    addMutateAsync.mockResolvedValue(undefined);
  });

  async function submitEmail(email: string) {
    const user = userEvent.setup();
    render(<OrganizationPage id="org-1" />);
    await user.click(screen.getByRole("button", { name: "Add member" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Email"), email);
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
  }

  it("keeps the dialog open with the typed email when the request is rejected", async () => {
    addMutateAsync.mockRejectedValueOnce(new Error("already a member"));
    await submitEmail("teemo@example.com");

    expect(addMutateAsync).toHaveBeenCalledTimes(1);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Email")).toHaveValue("teemo@example.com");
  });

  it("closes the dialog after the member is added", async () => {
    await submitEmail("teemo@example.com");

    expect(addMutateAsync).toHaveBeenCalledWith({
      id: "org-1",
      email: "teemo@example.com",
      role: "manager",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
