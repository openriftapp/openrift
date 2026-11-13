import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const update = vi.hoisted(() => ({
  mutate: vi.fn((_input: unknown, options?: { onError?: (error: Error) => void }) => {
    options?.onError?.(new Error("The request was aborted"));
  }),
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
  useUpdateSet: () => ({ mutate: update.mutate, mutateAsync: vi.fn(), isPending: false }),
  useCreateSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReorderSets: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSet: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/use-enums", () => ({ useLanguageList: () => [] }));

const { SetsPage } = await import("./sets-page");

describe("SetsPage release dates", () => {
  it("puts the stored date back when saving an edited date fails", () => {
    render(<SetsPage />);
    const input = screen.getByDisplayValue("2026-01-01");

    fireEvent.change(input, { target: { value: "2026-02-02" } });

    expect(update.mutate).toHaveBeenCalled();
    expect(screen.getByDisplayValue("2026-01-01")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("2026-02-02")).not.toBeInTheDocument();
  });
});
