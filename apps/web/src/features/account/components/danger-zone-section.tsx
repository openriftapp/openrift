import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { DangerZone } from "@/components/layout/danger-zone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/account/lib/auth-client";
import { useResetCollections } from "@/features/collections/hooks/use-collections";
import { sessionQueryOptions } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

const RESET_CONFIRM_WORD = "reset";

function resetSummaryMessage(summary: {
  removedCopies: number;
  removedCollections: number;
}): string {
  const copies = m.profile_danger_reset_summary_cards({ count: summary.removedCopies });
  const collections = m.profile_danger_reset_summary_collections({
    count: summary.removedCollections,
  });
  return m.profile_danger_reset_summary({ cards: copies, collections });
}

function ResetCollectionsAction() {
  const resetCollections = useResetCollections();

  async function handleReset() {
    const summary = await resetCollections.mutateAsync();
    toast.success(resetSummaryMessage(summary));
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">{m.profile_danger_reset_title()}</p>
        <p className="text-muted-foreground text-sm">{m.profile_danger_reset_description()}</p>
      </div>
      <ConfirmActionButton
        trigger={<Button variant="destructive" className="self-start" />}
        title={m.profile_danger_reset_dialog_title()}
        description={m.profile_danger_reset_dialog_description({ word: RESET_CONFIRM_WORD })}
        confirmLabel={m.profile_danger_reset_title()}
        pendingLabel={m.profile_danger_reset_pending()}
        confirmPhrase={RESET_CONFIRM_WORD}
        onConfirm={handleReset}
      >
        {m.profile_danger_reset_title()}
      </ConfirmActionButton>
    </div>
  );
}

function DeleteAccountAction() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  async function handleDelete() {
    if (!password) {
      setError(m.profile_danger_delete_password_required());
      return;
    }
    setLoading(true);
    setError(null);
    const result = await authClient.deleteUser({ password }).catch(() => null);
    setLoading(false);
    if (!result) {
      setError(m.profile_danger_delete_failed());
      return;
    }
    if (result.error) {
      setError(result.error.message ?? m.profile_danger_delete_failed());
      return;
    }
    // Navigate before invalidating the session query: flipping the session
    // synchronously would re-render the still-mounted authenticated routes
    // with no userId, and useRequiredUserId throws.
    try {
      await router.navigate({ to: "/" });
      void queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
    } catch {
      /* The account is already gone; a reload lands on the signed-out app. */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">{m.profile_danger_delete_title()}</p>
        <p className="text-muted-foreground text-sm">{m.profile_danger_delete_description()}</p>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setPassword("");
            setError(null);
          }
        }}
      >
        <AlertDialogTrigger
          render={
            <Button variant="destructive" className="self-start">
              {m.profile_danger_delete_title()}
            </Button>
          }
        />
        <AlertDialogContent>
          <DialogForm onSubmit={() => void handleDelete()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.profile_danger_delete_dialog_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.profile_danger_delete_dialog_description()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Input
                type="password"
                autoComplete="current-password"
                placeholder={m.profile_danger_delete_password_placeholder()}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
              <Button type="submit" variant="destructive" pending={loading}>
                {loading ? m.common_deleting() : m.profile_danger_delete_title()}
              </Button>
            </AlertDialogFooter>
          </DialogForm>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function DangerZoneSection() {
  return (
    <DangerZone
      title={m.profile_danger_title()}
      description={m.profile_danger_description()}
      contentClassName="flex-col flex-nowrap gap-6"
    >
      <ResetCollectionsAction />
      <DeleteAccountAction />
    </DangerZone>
  );
}
