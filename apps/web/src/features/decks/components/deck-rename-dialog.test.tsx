import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { save } = vi.hoisted(() => ({ save: vi.fn<(patch: unknown) => Promise<void>>() }));

vi.mock("@/features/decks/hooks/use-decks", async () => {
  const { useMutation } = await import("@tanstack/react-query");
  return {
    useUpdateDeckMeta: (_deckId: string, meta?: Record<string, unknown>) => {
      const mutation = useMutation({ mutationFn: save, meta });
      return {
        update: vi.fn(),
        save: mutation.mutateAsync,
        isPending: mutation.isPending,
        isError: mutation.isError,
        error: mutation.error,
      };
    },
  };
});

const { DeckRenameDialog } = await import("./deck-rename-dialog");

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <DeckRenameDialog deckId="deck-1" currentName="Jinx Aggro" open={open} onOpenChange={setOpen} />
  );
}

async function renameTo(name: string) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>,
  );
  const input = screen.getByLabelText("Name");
  await user.clear(input);
  await user.type(input, name);
  await user.click(screen.getByRole("button", { name: "Save" }));
  return input;
}

describe("DeckRenameDialog", () => {
  beforeEach(() => {
    save.mockReset();
  });

  it("closes once the rename is saved", async () => {
    save.mockResolvedValue();
    await renameTo("Jinx Burn");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(save.mock.calls[0]?.[0]).toEqual({ name: "Jinx Burn" });
  });

  it("stays open with the typed name and an inline error when the rename fails", async () => {
    save.mockRejectedValue(new TypeError("Failed to fetch"));
    const input = await renameTo("Jinx Burn");
    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(input).toHaveValue("Jinx Burn");
  });
});

function Caller({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <DeckRenameDialog deckId="deck-1" currentName={name} open={open} onOpenChange={setOpen} />
    </>
  );
}

async function openFromCaller(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open dialog" }));
  return screen.getByLabelText("Name");
}

describe("DeckRenameDialog opened through the open prop", () => {
  beforeEach(() => {
    save.mockReset();
  });

  function mount() {
    const client = new QueryClient();
    const view = render(
      <QueryClientProvider client={client}>
        <Caller name="Jinx Aggro" />
      </QueryClientProvider>,
    );
    const rename = (name: string) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Caller name={name} />
        </QueryClientProvider>,
      );
    return { rename };
  }

  it("starts from the current name after the typed text was dismissed", async () => {
    const user = userEvent.setup();
    mount();
    const input = await openFromCaller(user);
    await user.clear(input);
    await user.type(input, "Jinx Burn");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(await openFromCaller(user)).toHaveValue("Jinx Aggro");
  });

  it("starts from the current name without the error after a failed save", async () => {
    save.mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();
    mount();
    const input = await openFromCaller(user);
    await user.clear(input);
    await user.type(input, "Jinx Burn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    expect(await openFromCaller(user)).toHaveValue("Jinx Aggro");
    expect(screen.queryByText("Can't reach the server. Check your connection.")).toBeNull();
  });

  it("starts from the saved, trimmed name after a successful save", async () => {
    save.mockResolvedValue();
    const user = userEvent.setup();
    const { rename } = mount();
    const input = await openFromCaller(user);
    await user.clear(input);
    await user.type(input, "  Jinx Burn  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    rename("Jinx Burn");

    expect(await openFromCaller(user)).toHaveValue("Jinx Burn");
  });
});

describe("DeckRenameDialog while a save is pending", () => {
  let settle: { resolve: () => void; reject: (error: unknown) => void };

  beforeEach(() => {
    save.mockReset();
    save.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          settle = { resolve, reject };
        }),
    );
  });

  async function startSave(user: ReturnType<typeof userEvent.setup>) {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Caller name="Jinx Aggro" />
      </QueryClientProvider>,
    );
    const input = await openFromCaller(user);
    await user.clear(input);
    await user.type(input, "Jinx Burn");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(save).toHaveBeenCalled());
  }

  async function tryToDismiss(user: ReturnType<typeof userEvent.setup>) {
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  }

  it("stays open and shows the error when the save then fails", async () => {
    const user = userEvent.setup();
    await startSave(user);
    await tryToDismiss(user);

    settle.reject(new TypeError("Failed to fetch"));

    expect(
      await screen.findByText("Can't reach the server. Check your connection."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Jinx Burn");
  });

  it("closes once the save succeeds", async () => {
    const user = userEvent.setup();
    await startSave(user);
    await tryToDismiss(user);

    settle.resolve();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
