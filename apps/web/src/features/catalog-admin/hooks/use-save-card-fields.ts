import { useQueryClient } from "@tanstack/react-query";

import { useAcceptCardField } from "@/features/admin/hooks/use-admin-card-mutations";
import { compareScope } from "@/features/catalog-admin/hooks/use-compare-actions";
import type { CardFieldValue } from "@/features/catalog-admin/lib/card-field-form";

export function useSaveCardFields(cardSlug: string) {
  const queryClient = useQueryClient();
  const acceptCardField = useAcceptCardField([]);

  async function run(cardId: string, changes: readonly CardFieldValue[]): Promise<boolean> {
    // The loop lives in its own function because the React Compiler rejects
    // branching inside a `try` body.
    async function apply() {
      for (const change of changes) {
        await acceptCardField.mutateAsync({
          cardId,
          field: change.field,
          value: change.value,
          source: "manual",
        });
      }
    }

    let saved = true;
    try {
      await apply();
    } catch {
      saved = false;
    }
    for (const key of compareScope(cardSlug)) {
      void queryClient.invalidateQueries({ queryKey: [...key] });
    }
    return saved;
  }

  return { run, isPending: acceptCardField.isPending };
}
