import type {
  GroupStageView,
  LegendMetaShareView,
} from "@openrift/shared/types/api/pod-tournament";
import { Suspense, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCards } from "@/features/cards/hooks/use-cards";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useSetLegendMetaShares } from "@/features/tournaments/hooks/use-tournament-run";
import { legendNameFor } from "@/features/tournaments/lib/player-run";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

type PendingShares = GroupStageView["pendingMetaShares"];

/** Percent with at most one decimal, 0 to 100. */
function parseMetaShare(draft: string): number | null {
  const trimmed = draft.trim();
  if (!/^\d{1,3}(?:\.\d)?$/u.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  return value >= 0 && value <= 100 ? value : null;
}

function SharesForm({
  id,
  pending,
  shares,
  onDone,
}: {
  id: string;
  pending: PendingShares;
  shares: LegendMetaShareView[];
  onDone: () => void;
}) {
  const setShares = useSetLegendMetaShares();
  const { printingsByCardId } = useCards();
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const stored = new Map(shares.map((share) => [share.legendCardId, share.share]));
    return Object.fromEntries(
      pending.map((entry) => [
        entry.legendCardId,
        stored.has(entry.legendCardId) ? String(stored.get(entry.legendCardId)) : "",
      ]),
    );
  });

  const parsed = pending.map((entry) => parseMetaShare(drafts[entry.legendCardId] ?? ""));
  const complete = parsed.every((value) => value !== null);

  async function save() {
    const entries = pending.flatMap((entry) => {
      const value = parseMetaShare(drafts[entry.legendCardId] ?? "");
      return value === null ? [] : [{ legendCardId: entry.legendCardId, share: value }];
    });
    if (entries.length !== pending.length) {
      return;
    }
    if (await runReportedMutation(() => setShares.mutateAsync({ id, shares: entries }))) {
      onDone();
    }
  }

  return (
    <DialogForm onSubmit={() => void save()}>
      <DialogHeader>
        <DialogTitle>
          {m.tournaments_legend_meta_shares_title({ count: pending.length })}
        </DialogTitle>
        <DialogDescription>{m.tournaments_legend_meta_shares_description()}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-3">
        {pending.map((entry) => {
          const name = legendNameFor(printingsByCardId, entry.legendCardId, entry.legendName);
          return (
            <div key={entry.legendCardId} className="flex items-center justify-between gap-3">
              <Label htmlFor={`meta-${entry.legendCardId}`} className="min-w-0 truncate">
                {name}
              </Label>
              <span className="flex shrink-0 items-center gap-1.5">
                <Input
                  id={`meta-${entry.legendCardId}`}
                  inputMode="decimal"
                  value={drafts[entry.legendCardId] ?? ""}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [entry.legendCardId]: event.target.value,
                    }))
                  }
                  className="w-20 tabular-nums"
                  aria-label={m.tournaments_legend_meta_share_aria({ name })}
                />
                <span className="text-muted-foreground text-sm">%</span>
              </span>
            </div>
          );
        })}
      </div>
      <SaveError error={setShares.error} />
      <DialogFooter>
        <DialogCancel />
        <Button type="submit" disabled={!complete} pending={setShares.isPending}>
          {m.common_save()}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

export function LegendMetaSharesButton({
  id,
  pending,
  shares,
}: {
  id: string;
  pending: PendingShares;
  shares: LegendMetaShareView[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {m.tournaments_cut_enter_meta_shares()}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <Suspense fallback={null}>
            <SharesForm
              key={String(open)}
              id={id}
              pending={pending}
              shares={shares}
              onDone={() => setOpen(false)}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
