import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminCardErrata } from "@/features/admin/lib/errata-draft";

const captured = vi.hoisted(() => ({ remove: vi.fn() }));

vi.mock("@/features/cards/hooks/use-card-errata", () => ({
  useUpsertCardErrata: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteCardErrata: () => ({ mutateAsync: captured.remove, isPending: false }),
}));
vi.mock("@/features/admin/hooks/use-admin-card-queries", () => ({
  useErrataAnnouncements: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useLanguageList: () => [{ code: "EN", name: "English", color: null }],
}));

import { CardErrataSection } from "./card-errata-section";

const errata = [
  {
    language: "EN",
    correctedRulesText: "Deal 2 to a unit.",
    correctedEffectText: null,
    source: "Riot",
    sourceUrl: null,
    effectiveDate: null,
    announcementId: null,
  },
] as unknown as AdminCardErrata[];

async function removeErrata(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Remove the English errata" }));
  await user.click(await screen.findByRole("button", { name: "Remove errata" }));
}

describe("CardErrataSection writes", () => {
  beforeEach(() => {
    captured.remove.mockReset().mockResolvedValue(undefined);
  });

  it("removes directly when no runWrite is given", async () => {
    const user = userEvent.setup();
    render(<CardErrataSection cardId="card-1" errata={errata} />);
    await removeErrata(user);

    expect(captured.remove).toHaveBeenCalledWith(
      { cardId: "card-1", language: "EN" },
      { signal: undefined },
    );
  });

  it("hands the write to runWrite, which passes its signal into the mutation", async () => {
    const user = userEvent.setup();
    const { signal } = new AbortController();
    const runWrite = vi.fn((write: (signal?: AbortSignal) => Promise<unknown>) =>
      write(signal).then(() => true),
    );
    render(<CardErrataSection cardId="card-1" errata={errata} runWrite={runWrite} />);
    await removeErrata(user);

    expect(runWrite).toHaveBeenCalledOnce();
    expect(captured.remove).toHaveBeenCalledWith({ cardId: "card-1", language: "EN" }, { signal });
  });
});
