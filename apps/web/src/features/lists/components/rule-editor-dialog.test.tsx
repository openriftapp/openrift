import type { ListRule } from "@openrift/shared/types/list-rule";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

const saveRules = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
}));

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useSaveListRules: () => saveRules,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/features/cards/lib/catalog-queries", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ensureCatalogComplete: () => Promise.resolve(),
}));

vi.mock("@/features/lists/components/rule-editors", () => ({
  CardRuleEditor: () => null,
  CopyRuleEditor: () => null,
}));

const { RuleEditorDialog } = await import("./rule-editor-dialog");
const { useRuleEditorStore } = await import("@/features/rules/stores/rule-editor-store");

const resetStore = createStoreResetter(useRuleEditorStore);

function wishRule(): ListRule {
  return {
    kind: "wish",
    filter: EMPTY_CARD_FILTERS,
    quantity: { mode: "fixed", n: 1 },
    excludeIds: [],
  };
}

function makeClient() {
  const client = new QueryClient();
  vi.spyOn(client, "query").mockResolvedValue(undefined);
  return client;
}

describe("RuleEditorDialog", () => {
  afterEach(() => {
    resetStore();
    document.body.innerHTML = "";
  });

  it("keeps an in-progress draft when the saved rules refetch", () => {
    const client = makeClient();
    const dialog = (rules: ListRule[]) => (
      <QueryClientProvider client={client}>
        <RuleEditorDialog
          listId="list-1"
          intent="wish"
          kind="card"
          currentRules={rules}
          currentRuleCombine={null}
          currentRulesVersion={2}
          open
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>
    );
    const view = render(dialog([wishRule()]));
    expect(useRuleEditorStore.getState().rules).toHaveLength(1);

    useRuleEditorStore.getState().addRule();
    view.rerender(dialog([wishRule()]));

    expect(useRuleEditorStore.getState().rules).toHaveLength(2);
    view.unmount();
  });

  it("keeps the draft and saves against the newer version after a refusal", async () => {
    const client = makeClient();
    const onOpenChange = vi.fn();
    saveRules.mutateAsync.mockResolvedValueOnce({
      outcome: "stale",
      rules: [],
      ruleCombine: "max",
      rulesVersion: 6,
    });
    saveRules.mutateAsync.mockResolvedValueOnce({ outcome: "saved" });
    const view = render(
      <QueryClientProvider client={client}>
        <RuleEditorDialog
          listId="list-1"
          intent="wish"
          kind="card"
          currentRules={[wishRule()]}
          currentRuleCombine={null}
          currentRulesVersion={2}
          open
          onOpenChange={onOpenChange}
        />
      </QueryClientProvider>,
    );
    useRuleEditorStore.getState().addRule();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(saveRules.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRulesVersion: 2 }),
    );
    expect(screen.getByText("The saved rules changed")).toBeTruthy();
    expect(useRuleEditorStore.getState().rules).toHaveLength(2);
    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(saveRules.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ expectedRulesVersion: 6 }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    view.unmount();
  });

  it("loads the stored rules over the draft on request", async () => {
    const client = makeClient();
    saveRules.mutateAsync.mockResolvedValueOnce({
      outcome: "stale",
      rules: [],
      ruleCombine: "max",
      rulesVersion: 6,
    });
    const view = render(
      <QueryClientProvider client={client}>
        <RuleEditorDialog
          listId="list-1"
          intent="wish"
          kind="card"
          currentRules={[wishRule()]}
          currentRuleCombine={null}
          currentRulesVersion={2}
          open
          onOpenChange={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard my changes" }));

    const state = useRuleEditorStore.getState();
    expect(state.rules).toEqual([]);
    expect(state.ruleCombine).toBe("max");
    expect(state.rulesVersion).toBe(6);
    expect(screen.queryByText("The saved rules changed")).toBeNull();
    view.unmount();
  });
});
