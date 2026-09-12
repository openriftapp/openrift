import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import {
  useCancelTournament,
  useDeleteTournament,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function DangerZoneCard({ detail }: { detail: TournamentDetailResponse }) {
  const navigate = useNavigate();
  const cancelTournament = useCancelTournament();
  const deleteTournament = useDeleteTournament();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleCancel() {
    await runReportedMutation(() => cancelTournament.mutateAsync({ id: detail.id }));
    setConfirmCancel(false);
  }

  async function handleDelete() {
    await runReportedMutation(async () => {
      await deleteTournament.mutateAsync(detail.id);
      await navigate({ to: "/tournaments" });
    });
  }

  return (
    <>
      <Card className="ring-destructive/50">
        <CardHeader>
          <CardTitle>{m.tournaments_settings_danger_zone_title()}</CardTitle>
          <CardDescription>{m.tournaments_settings_danger_zone_description()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {detail.status === "cancelled" ? null : (
              <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                {m.tournaments_settings_cancel_tournament()}
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              {m.tournaments_settings_delete_tournament()}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleCancel()}>
            <DialogHeader>
              <DialogTitle>
                {m.tournaments_settings_cancel_confirm_title({ name: detail.name })}
              </DialogTitle>
              <DialogDescription>
                {m.tournaments_settings_cancel_confirm_description()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                {m.tournaments_settings_keep_it()}
              </Button>
              <Button type="submit" variant="secondary" disabled={cancelTournament.isPending}>
                {m.tournaments_settings_cancel_tournament()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleDelete()}>
            <DialogHeader>
              <DialogTitle>
                {m.tournaments_settings_delete_confirm_title({ name: detail.name })}
              </DialogTitle>
              <DialogDescription>
                {m.tournaments_settings_delete_confirm_description()}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteTournament.isPending}>
                {m.common_delete()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
