import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const patch = vi.hoisted(() => vi.fn());

function idle() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false };
}

vi.mock("@/features/admin/components/admin-page-top-bar", () => ({
  AdminPageTopBar: ({ actions }: { actions?: ReactNode }) => <div>{actions}</div>,
}));
vi.mock("@/features/admin/components/language-select", () => ({ LanguageSelect: () => null }));

vi.mock("@/features/admin/hooks/use-keywords", () => ({
  useKeywordStats: () => ({
    data: {
      counts: [{ keyword: "Accelerate", count: 3 }],
      styles: [
        {
          name: "Accelerate",
          color: "#112233",
          darkText: false,
          costKeyword: false,
          cardModifier: false,
        },
      ],
      translations: [],
    },
  }),
  useRecomputeKeywords: idle,
  useDiscoverTranslations: idle,
  useUpdateKeywordStyle: idle,
  useDeleteKeywordStyle: idle,
  useCreateKeywordStyle: idle,
  useUpsertTranslation: idle,
  useDeleteTranslation: idle,
  usePatchKeywordFlags: () => ({ mutate: patch, isPending: false }),
}));

const { KeywordsPage } = await import("./keywords-page");

describe("KeywordsPage flag checkboxes", () => {
  it("sends only the ticked flag, so a second tick before the refetch keeps the first", () => {
    render(<KeywordsPage />);
    const [, cost, modifier] = screen.getAllByRole("checkbox");
    if (cost === undefined || modifier === undefined) {
      throw new Error("expected the flag checkboxes");
    }

    fireEvent.click(cost);
    fireEvent.click(modifier);

    expect(patch.mock.calls.map(([input]) => input)).toEqual([
      { name: "Accelerate", insertColor: "#112233", costKeyword: true },
      { name: "Accelerate", insertColor: "#112233", cardModifier: true },
    ]);
  });
});
