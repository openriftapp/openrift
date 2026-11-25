import { useNavigate } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { ManualCardFields } from "@/features/admin/components/manual-card-fields";
import { useCreateCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { useManualCardDraft } from "@/features/admin/hooks/use-manual-card-draft";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export function CreateCardPage() {
  const navigate = useNavigate();
  const createCard = useCreateCard();
  const draft = useManualCardDraft();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = draft.input !== undefined && !createCard.isPending;

  async function handleSubmit() {
    const input = draft.input;
    if (input === undefined || createCard.isPending) {
      return;
    }
    setErrorMsg(null);
    let result: Awaited<ReturnType<typeof createCard.mutateAsync>> | undefined;
    const ok = await runReportedMutation(
      async () => {
        result = await createCard.mutateAsync(input);
      },
      (error) => setErrorMsg(errorText(error, "Failed to create card")),
    );
    if (ok && result) {
      void navigate({ to: "/admin/cards/$cardSlug", params: { cardSlug: result.cardSlug } });
    }
  }

  return (
    <div className="max-w-2xl">
      <AdminPageTopBar title="Create Card" />
      <Card>
        <CardHeader>
          <CardTitle>Create new card</CardTitle>
          <CardDescription>Slug is auto-generated from the name until you edit it.</CardDescription>
        </CardHeader>

        <CardContent>
          <FieldGroup>
            <ManualCardFields draft={draft} idPrefix="create-card" />

            {errorMsg && (
              <Alert variant="destructive">
                <AlertDescription>{errorMsg}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button disabled={!canSubmit} onClick={() => void handleSubmit()}>
                <PlusIcon className="size-4" />
                Create card
              </Button>
              <Button variant="ghost" onClick={() => void navigate({ to: "/admin/cards" })}>
                Cancel
              </Button>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
