import type { ListRule } from "@openrift/shared/types/list-rule";
import { EMPTY_CARD_FILTERS } from "@openrift/shared/types/search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

vi.mock("@/features/lists/hooks/use-lists", () => ({
  useUpdateList: () => ({ mutate: vi.fn(), isPending: false }),
}));

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
});
