import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/features/account/lib/auth-client";
import { useResetCollections } from "@/features/collections/hooks/use-collections";
import { sessionQueryOptions } from "@/lib/auth-session";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

const RESET_CONFIRM_WORD = "reset";

// Lives outside the handler: React Compiler cannot lower a conditional inside
// a try/catch.
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
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const resetCollections = useResetCollections();

  async function handleReset() {
    if (confirmText.trim().toLowerCase() !== RESET_CONFIRM_WORD) {
      setError(m.profile_danger_reset_confirm_error({ word: RESET_CONFIRM_WORD }));
      return;
    }
    setError(null);
    try {
      const summary = await resetCollections.mutateAsync();
      setOpen(false);
      toast.success(resetSummaryMessage(summary));
    } catch (resetError) {
      setError(errorText(resetError, m.profile_danger_reset_failed()));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-medium">{m.profile_danger_reset_title()}</p>
        <p className="text-muted-foreground text-sm">{m.profile_danger_reset_description()}</p>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setConfirmText("");
            setError(null);
          }
        }}
      >
        <AlertDialogTrigger
          render={
            <Button variant="destructive" className="self-start">
              {m.profile_danger_reset_title()}
            </Button>
          }
        />
        <AlertDialogContent>
          <DialogForm onSubmit={() => void handleReset()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.profile_danger_reset_dialog_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.profile_danger_reset_dialog_description({ word: RESET_CONFIRM_WORD })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2">
              <Input
                autoComplete="off"
                placeholder={m.profile_danger_reset_placeholder({ word: RESET_CONFIRM_WORD })}
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                aria-invalid={Boolean(error)}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>{m.profile_danger_cancel()}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={resetCollections.isPending}>
                {resetCollections.isPending
                  ? m.profile_danger_reset_pending()
                  : m.profile_danger_reset_title()}
              </Button>
            </AlertDialogFooter>
          </DialogForm>
        </AlertDialogContent>
      </AlertDialog>
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
              <AlertDialogCancel>{m.profile_danger_cancel()}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? m.profile_danger_delete_pending() : m.profile_danger_delete_title()}
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
    <Card className="ring-destructive/50">
      <CardHeader>
        <CardTitle>{m.profile_danger_title()}</CardTitle>
        <CardDescription>{m.profile_danger_description()}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ResetCollectionsAction />
        <DeleteAccountAction />
      </CardContent>
    </Card>
  );
}
