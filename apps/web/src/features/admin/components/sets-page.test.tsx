import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const releases = vi.hoisted(() => ({
  put: vi.fn((_input: unknown): Promise<void> => Promise.reject(new Error("aborted"))),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  createLink: (component: unknown) => component,
}));

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));

vi.mock("@/features/admin/components/set-picker", () => ({ SetPicker: () => null }));
vi.mock("@/features/admin/components/language-select", () => ({ LanguageSelect: () => null }));

vi.mock("@/features/cards/hooks/use-sets", () => ({
  useSets: () => ({
    data: {
      sets: [
        {
          id: "s1",
          slug: "OGN",
          name: "Origins",
          printedTotal: null,
          setType: "main",
          releases: { EN: { releasedAt: "2026-01-01", precision: "day" } },
          cardCount: 0,
          printingCount: 0,
        },
      ],
    },
  }),
  useUpdateSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReorderSets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/admin/hooks/use-set-releases", () => ({
  usePutSetRelease: () => ({ mutateAsync: releases.put, isPending: false }),
  useDeleteSetRelease: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-enums", () => ({ useLanguageList: () => [], useCircuitList: () => [] }));

vi.mock("@/features/admin/hooks/use-format-sets", () => ({
  useFormatSets: () => ({ data: [] }),
  useUpsertFormatSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRemoveFormatSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const { SetsPage } = await import("./sets-page");

describe("SetsPage sets table", () => {
  it("lets a long set name wrap so the table fits beside the admin sidebar", () => {
    render(<SetsPage />);
    expect(screen.getByRole("cell", { name: "Origins" })).toHaveClass("whitespace-normal");
  });
});

describe("SetsPage release dates", () => {
  it("puts the stored date back when saving an edited date fails", async () => {
    render(<SetsPage />);
    const input = screen.getByDisplayValue("2026-01-01");

    fireEvent.change(input, { target: { value: "2026-02-02" } });

    await waitFor(() => expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument());
    expect(screen.queryByDisplayValue("2026-02-02")).not.toBeInTheDocument();
  });

  it("writes only the edited language and locks its row until the write lands", async () => {
    const gate = { open: () => {} };
    releases.put.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          gate.open = resolve;
        }),
    );
    render(<SetsPage />);

    fireEvent.change(screen.getByDisplayValue("2026-01-01"), { target: { value: "2026-02-02" } });

    expect(releases.put).toHaveBeenCalledWith({
      id: "s1",
      language: "EN",
      release: { releasedAt: "2026-02-02", precision: "day" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Month" })).toBeDisabled());
    gate.open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Month" })).toBeEnabled());
  });
});
