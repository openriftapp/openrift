import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({ remove: vi.fn() }));

const ban = {
  id: "ban-1",
  cardId: "card-1",
  formatId: "standard",
  formatName: "Standard",
  bannedAt: "2026-01-01",
  reason: null,
} as unknown as CardBanResponse;

vi.mock("@/features/cards/hooks/use-card-bans", () => ({
  useCardBans: () => ({ data: [ban], isPending: false }),
  useCreateCardBan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateCardBan: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveCardBan: () => ({ mutateAsync: captured.remove, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-formats", () => ({
  useFormats: () => ({ data: [] }),
}));

import { CardBansSection } from "./card-bans-section";

vi.mock("@/hooks/use-enums", () => ({ useCircuitList: () => [] }));

async function liftBan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Remove the Standard ban" }));
  await user.click(await screen.findByRole("button", { name: "Remove ban" }));
}

describe("CardBansSection writes", () => {
  beforeEach(() => {
    captured.remove.mockReset().mockResolvedValue(undefined);
  });

  it("lifts a ban directly when no runWrite is given", async () => {
    const user = userEvent.setup();
    render(<CardBansSection cardId="card-1" />);
    await liftBan(user);

    expect(captured.remove).toHaveBeenCalledWith(
      { cardId: "card-1", formatId: "standard" },
      { signal: undefined },
    );
  });

  it("hands the write to runWrite, which passes its signal into the mutation", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn((write: (signal?: AbortSignal) => Promise<unknown>) =>
      write(signal).then(() => true),
    );
    render(<CardBansSection cardId="card-1" runWrite={runWrite} />);
    await liftBan(user);

    expect(runWrite).toHaveBeenCalledOnce();
    expect(captured.remove).toHaveBeenCalledWith(
      { cardId: "card-1", formatId: "standard" },
      { signal },
    );
  });
});
