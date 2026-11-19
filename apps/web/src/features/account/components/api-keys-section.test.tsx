import type { ApiKeyResponse } from "@openrift/shared/types/api/api-key";
import type { DeckCheckKeyResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const renameMutateAsync = vi.fn<(variables: unknown) => Promise<unknown>>();
const createMutateAsync = vi.fn<(variables: unknown) => Promise<{ token: string }>>();
const mintMutateAsync = vi.fn<(variables: unknown) => Promise<{ token: string }>>();
let adminAccess = { isAdmin: false, sections: [] as string[] };

const decklistKey = {
  id: "key-1",
  label: "Store laptop",
  tokenPrefix: "dck_abc",
  createdAt: "2026-06-01T10:00:00.000Z",
  createdByName: null,
  lastUsedAt: null,
  revokedAt: null,
} as unknown as DeckCheckKeyResponse;

const accountKey: ApiKeyResponse = {
  id: "acct-1",
  name: "Deck sync bot",
  start: "orift_",
  grants: { collection: "read", lists: "none", decks: "write" },
  admin: false,
  createdAt: "2026-07-01T10:00:00.000Z",
  expiresAt: null,
  lastUsedAt: null,
};

function idle() {
  return { mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() };
}

function useMutationStub(mutate: (variables: unknown) => Promise<unknown>) {
  const [error, setError] = useState<unknown>(null);
  return {
    mutateAsync: (variables: unknown) =>
      mutate(variables).catch((error_: unknown) => {
        setError(error_);
        throw error_;
      }),
    isPending: false,
    error,
    reset: () => setError(null),
  };
}

vi.mock("@/features/tournaments/hooks/use-deck-check-keys", () => ({
  useMyDeckCheckKeys: () => ({ data: { items: [decklistKey] } }),
  useMintMyDeckCheckKey: () => useMutationStub(mintMutateAsync),
  useRenameMyDeckCheckKey: () => useMutationStub(renameMutateAsync),
  useRevokeMyDeckCheckKey: idle,
  useRemoveMyDeckCheckKey: idle,
  useOrgDeckCheckKeys: () => ({ data: { items: [] } }),
  useMintOrgDeckCheckKey: idle,
  useRenameOrgDeckCheckKey: idle,
  useRevokeOrgDeckCheckKey: idle,
  useRemoveOrgDeckCheckKey: idle,
}));

vi.mock("@/features/account/hooks/use-api-keys", () => ({
  useApiKeys: () => ({ data: [accountKey] }),
  useCreateApiKey: () => useMutationStub(createMutateAsync),
  useDeleteApiKey: idle,
}));

vi.mock("@/features/admin/hooks/use-admin", () => ({
  useAdminAccess: () => ({ data: adminAccess }),
}));

const { ApiKeysSection } = await import("./api-keys-section");

beforeEach(() => {
  renameMutateAsync.mockReset();
  createMutateAsync.mockReset();
  mintMutateAsync.mockReset();
  createMutateAsync.mockResolvedValue({ token: "orift_secret" });
  mintMutateAsync.mockResolvedValue({ token: "orpk_secret" });
  adminAccess = { isAdmin: false, sections: [] };
});

async function renameTo(user: ReturnType<typeof userEvent.setup>, label: string) {
  const input = await screen.findByRole("textbox");
  await user.clear(input);
  await user.type(input, label);
  await user.click(screen.getByRole("button", { name: "Save" }));
}

describe("ApiKeysSection list", () => {
  it("lists account keys with their scopes beside decklist keys", () => {
    render(<ApiKeysSection />);
    expect(screen.getByText("Deck sync bot")).toBeInTheDocument();
    expect(screen.getByText("Collection: Read and Decks: Read & write")).toBeInTheDocument();
    expect(screen.getByText("Store laptop")).toBeInTheDocument();
    expect(screen.getByText("Tournament decklists")).toBeInTheDocument();
  });
});

describe("ApiKeysSection create", () => {
  it("creates an account key with the picked scopes and expiry, then shows the token", async () => {
    const user = userEvent.setup();
    render(<ApiKeysSection />);

    await user.click(screen.getByRole("button", { name: "Create key" }));
    await user.type(screen.getByLabelText("Name"), "Sync script");
    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    const decks = screen.getByRole("group", { name: "Decks" });
    await user.click(within(decks).getByRole("button", { name: "Read & write" }));
    expect(create).toBeEnabled();
    await user.click(create);

    expect(createMutateAsync).toHaveBeenCalledWith({
      name: "Sync script",
      grants: { collection: "none", lists: "none", decks: "write" },
      admin: false,
      expiresInDays: 90,
    });
    expect(await screen.findByDisplayValue("orift_secret")).toBeInTheDocument();
  });

  it("creates a decklist key from just a name", async () => {
    const user = userEvent.setup();
    render(<ApiKeysSection />);

    await user.click(screen.getByRole("button", { name: "Create key" }));
    await user.click(screen.getByRole("radio", { name: /Tournament decklists/u }));
    expect(screen.queryByRole("group", { name: "Decks" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Front desk");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(mintMutateAsync).toHaveBeenCalledWith({ label: "Front desk" });
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it("keeps the dialog open with the error when creation fails", async () => {
    createMutateAsync.mockRejectedValueOnce(new Error("Key limit reached"));
    const user = userEvent.setup();
    render(<ApiKeysSection />);

    await user.click(screen.getByRole("button", { name: "Create key" }));
    await user.type(screen.getByLabelText("Name"), "Sync script");
    const collection = screen.getByRole("group", { name: "Collection" });
    await user.click(within(collection).getByRole("button", { name: "Read" }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Key limit reached")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("offers admin access only to users with admin access", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ApiKeysSection />);
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(screen.queryByRole("switch", { name: "Admin access" })).not.toBeInTheDocument();
    unmount();

    adminAccess = { isAdmin: false, sections: ["printing-desk"] };
    render(<ApiKeysSection />);
    await user.click(screen.getByRole("button", { name: "Create key" }));
    expect(screen.getByRole("switch", { name: "Admin access" })).toBeInTheDocument();
  });
});

describe("ApiKeysSection decklist key rename", () => {
  it("keeps the dialog open and shows the error when the rename fails", async () => {
    renameMutateAsync.mockRejectedValueOnce(new Error("That name is already used."));
    const user = userEvent.setup();
    render(<ApiKeysSection />);

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    await renameTo(user, "Front desk");

    expect(renameMutateAsync).toHaveBeenCalledWith({ keyId: "key-1", label: "Front desk" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("That name is already used.")).toBeInTheDocument();
  });

  it("drops the old error when the label is put back and saved", async () => {
    renameMutateAsync.mockRejectedValueOnce(new Error("That name is already used."));
    const user = userEvent.setup();
    render(<ApiKeysSection />);

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    await renameTo(user, "Front desk");
    expect(await screen.findByText("That name is already used.")).toBeInTheDocument();
    await renameTo(user, "Store laptop");

    await user.click(screen.getByRole("button", { name: "Rename key" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("That name is already used.")).not.toBeInTheDocument();
  });
});
