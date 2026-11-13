import type { DeckCheckKeyResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renameMutateAsync = vi.fn<(variables: unknown) => Promise<unknown>>();

const key = {
  id: "key-1",
  label: "Store laptop",
  tokenPrefix: "dck_abc",
  createdAt: "2026-06-01T10:00:00.000Z",
  createdByName: null,
  lastUsedAt: null,
  revokedAt: null,
} as unknown as DeckCheckKeyResponse;

function idle() {
  return { mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() };
}

vi.mock("@/features/tournaments/hooks/use-deck-check-keys", async () => {
  const { useState } = await import("react");
  return {
    useMyDeckCheckKeys: () => ({ data: { items: [key] } }),
    useMintMyDeckCheckKey: idle,
    useRenameMyDeckCheckKey: () => {
      const [error, setError] = useState<unknown>(null);
      return {
        mutateAsync: (variables: unknown) =>
          renameMutateAsync(variables).catch((error_: unknown) => {
            setError(error_);
            throw error_;
          }),
        isPending: false,
        error,
        reset: () => setError(null),
      };
    },
    useRevokeMyDeckCheckKey: idle,
    useRemoveMyDeckCheckKey: idle,
    useOrgDeckCheckKeys: () => ({ data: { items: [] } }),
    useMintOrgDeckCheckKey: idle,
    useRenameOrgDeckCheckKey: idle,
    useRevokeOrgDeckCheckKey: idle,
    useRemoveOrgDeckCheckKey: idle,
  };
});

const { MyDeckCheckKeysSection } = await import("./deck-check-keys-section");

beforeEach(() => {
  renameMutateAsync.mockReset();
});

async function renameTo(user: ReturnType<typeof userEvent.setup>, label: string) {
  const input = await screen.findByRole("textbox");
  await user.clear(input);
  await user.type(input, label);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("MyDeckCheckKeysSection rename", () => {
  it("keeps the dialog open and shows the error when the rename fails", async () => {
    renameMutateAsync.mockRejectedValueOnce(new Error("That name is already used."));
    const user = userEvent.setup();
    render(<MyDeckCheckKeysSection />);

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    await renameTo(user, "Front desk");

    expect(renameMutateAsync).toHaveBeenCalledWith({ keyId: "key-1", label: "Front desk" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("That name is already used.")).toBeInTheDocument();
  });

  it("drops the old error when the label is put back and saved", async () => {
    renameMutateAsync.mockRejectedValueOnce(new Error("That name is already used."));
    const user = userEvent.setup();
    render(<MyDeckCheckKeysSection />);

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    await renameTo(user, "Front desk");
    expect(await screen.findByText("That name is already used.")).toBeInTheDocument();
    await renameTo(user, "Store laptop");

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("That name is already used.")).not.toBeInTheDocument();
  });
});
