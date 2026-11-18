import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import type { ListRule, ListRuleCombine } from "@openrift/shared/types/list-rule";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffectEvent, useLayoutEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Skeleton } from "@/components/ui/skeleton";
import { catalogQueryOptions, ensureCatalogComplete } from "@/features/cards/lib/catalog-queries";
import { customTagsQueryOptions } from "@/features/cards/lib/custom-tags-queries";
import { pricesQueryOptions } from "@/features/cards/lib/prices-queries";
import { CardRuleEditor, CopyRuleEditor } from "@/features/lists/components/rule-editors";
import type { SaveListRulesResult } from "@/features/lists/hooks/use-lists";
import { useSaveListRules } from "@/features/lists/hooks/use-lists";
import type { ListRulesState } from "@/features/lists/lib/list-rules-conflict";
import { ruleWording } from "@/features/rules/lib/rule-wording";
import { useRuleEditorStore } from "@/features/rules/stores/rule-editor-store";
import { errorText } from "@/lib/error-text";
import { initQueryOptions } from "@/lib/init-queries";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { UserDeclinedError } from "@/lib/user-declined-error";
import { m } from "@/paraglide/messages.js";

interface RuleEditorDialogProps {
  listId: string;
  intent: ListIntent;
  kind: ListKind;
  currentRules: ListRule[];
  currentRuleCombine: ListRuleCombine | null;
  currentRulesVersion: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RuleEditorDialog({
  listId,
  intent,
  kind,
  currentRules,
  currentRuleCombine,
  currentRulesVersion,
  open,
  onOpenChange,
}: RuleEditorDialogProps) {
  const saveRules = useSaveListRules();
  const queryClient = useQueryClient();
  const [stored, setStored] = useState<ListRulesState | null>(null);

  const load = useRuleEditorStore((state) => state.load);
  const rebase = useRuleEditorStore((state) => state.rebase);
  const reset = useRuleEditorStore((state) => state.reset);
  const buildRules = useRuleEditorStore((state) => state.buildRules);

  const loadDraft = useEffectEvent(() =>
    load(currentRules, currentRuleCombine, currentRulesVersion),
  );

  // Prewarms queries so a rule block's useSuspenseQuery doesn't suspend cold
  // and collapse the pending boundary, resetting `open` and closing the dialog.
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    loadDraft();
    void (async () => {
      await queryClient.query({ ...catalogQueryOptions, staleTime: "static" });
      await ensureCatalogComplete(queryClient);
    })();
    void queryClient.query({ ...initQueryOptions, staleTime: "static" });
    void queryClient.query({ ...customTagsQueryOptions, staleTime: "static" });
    void queryClient.query({ ...pricesQueryOptions, staleTime: "static" });
    return () => reset();
  }, [open, reset, queryClient]);

  const wording = ruleWording(intent, kind);

  const handleSave = async () => {
    if (saveRules.isPending) {
      return;
    }
    const next = buildRules(kind);
    const { ruleCombine, rulesVersion } = useRuleEditorStore.getState();
    let result: SaveListRulesResult | undefined;
    const ok = await runReportedMutation(async () => {
      result = await saveRules.mutateAsync({
        listId,
        rules: next,
        ruleCombine,
        expectedRulesVersion: rulesVersion,
      });
    });
    if (!ok || !result) {
      return;
    }
    if (result.outcome === "stale") {
      rebase(result.rulesVersion);
      setStored(result);
      return;
    }
    toast.success(next.length > 0 ? m.lists_rule_toast_saved() : m.lists_rule_toast_removed());
    onOpenChange(false);
  };

  const loadStored = () => {
    if (stored) {
      load(stored.rules, stored.ruleCombine, stored.rulesVersion);
      setStored(null);
    }
  };

  const saveError =
    saveRules.isError && !(saveRules.error instanceof UserDeclinedError)
      ? errorText(saveRules.error, m.common_error_generic())
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogForm onSubmit={() => void handleSave()}>
          <DialogHeader>
            <DialogTitle>{m.lists_rule_dialog_title()}</DialogTitle>
            <DialogDescription>{wording.description}</DialogDescription>
          </DialogHeader>

          <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
            {wording.isCopy ? (
              <CopyRuleEditor intent={intent} kind={kind} wording={wording} />
            ) : (
              <CardRuleEditor intent={intent} kind={kind} wording={wording} />
            )}
          </Suspense>

          {stored && (
            <Alert variant="warning">
              <AlertTitle>{m.lists_rule_conflict_title()}</AlertTitle>
              <AlertDescription>
                <p>{m.lists_rule_conflict_body()}</p>
                <Button type="button" variant="outline" size="sm" onClick={loadStored}>
                  {m.lists_rule_conflict_load_saved()}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <DialogCancel disabled={saveRules.isPending} />
            <Button type="submit" pending={saveRules.isPending}>
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
