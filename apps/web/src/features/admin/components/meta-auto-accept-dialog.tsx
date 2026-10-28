import type { MetaSource, MetaSyncSettings } from "@openrift/shared/contracts/admin/meta-catalog";
import { META_NOTABLE_EVENT_NAMES } from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDayTime } from "@openrift/shared/format-date";
import { META_CATALOG_PROVIDERS } from "@openrift/shared/types/enums";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useMetaSyncSettings,
  useUpdateMetaSyncSettings,
} from "@/features/admin/hooks/use-admin-meta-catalog";
import { autoPublishRuleSentence } from "@/features/admin/lib/meta-mirror-view";
import { META_SOURCE_LABELS } from "@/features/meta/lib/meta-catalog-display";

/** The auto-accept rule form's editable shape. */
interface RulesDraft {
  minPlayersEnabled: boolean;
  minPlayers: string;
  notable: boolean;
  official: boolean;
}

function toDraft(settings: MetaSyncSettings): RulesDraft {
  return {
    minPlayersEnabled: settings.autoAcceptMinPlayers !== null,
    minPlayers:
      settings.autoAcceptMinPlayers === null ? "64" : String(settings.autoAcceptMinPlayers),
    notable: settings.autoAcceptNotable,
    official: settings.autoAcceptOfficial,
  };
}

const notableNames = new Intl.ListFormat("en", { type: "disjunction" }).format(
  META_NOTABLE_EVENT_NAMES,
);

function AutoAcceptForm({
  source,
  settings,
  onClose,
}: {
  source: MetaSource;
  settings: MetaSyncSettings;
  onClose: () => void;
}) {
  const update = useUpdateMetaSyncSettings();
  const [draft, setDraft] = useState(() => toDraft(settings));
  // A save answers with the stored row, and the stamp is what says it landed.
  // Copying it back in keeps the form showing what the server actually holds.
  const [seenAt, setSeenAt] = useState(settings.updatedAt);
  if (settings.updatedAt !== seenAt) {
    setSeenAt(settings.updatedAt);
    setDraft(toDraft(settings));
  }

  const playerCountValid = /^\d+$/u.test(draft.minPlayers) && Number(draft.minPlayers) > 0;
  const canSave = (!draft.minPlayersEnabled || playerCountValid) && !update.isPending;

  function save() {
    update.mutate({
      autoAcceptMinPlayers: draft.minPlayersEnabled ? Number(draft.minPlayers) : null,
      autoAcceptNotable: draft.notable,
      autoAcceptOfficial: draft.official,
    });
  }

  return (
    <DialogForm onSubmit={save}>
      <DialogHeader>
        <DialogTitle>Auto-publish rule</DialogTitle>
        <DialogDescription>
          Refresh mirror publishes a matching event and collects its results without review.
          Rejected and cancelled events never publish.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <dl className="bg-muted grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-md px-3 py-2 text-sm">
          {META_CATALOG_PROVIDERS.map((provider) => (
            <div key={provider} className="contents">
              <dt className={provider === source ? "font-medium" : "text-muted-foreground"}>
                {META_SOURCE_LABELS[provider]}
              </dt>
              <dd>{autoPublishRuleSentence(provider, settings)}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-3">
          <Switch
            id="meta-auto-accept-players"
            checked={draft.minPlayersEnabled}
            onCheckedChange={(checked: boolean) =>
              setDraft((prev) => ({ ...prev, minPlayersEnabled: checked }))
            }
          />
          <Label htmlFor="meta-auto-accept-players">Publish events with at least</Label>
          <Input
            type="number"
            min={1}
            value={draft.minPlayers}
            disabled={!draft.minPlayersEnabled}
            onChange={(event) => setDraft((prev) => ({ ...prev, minPlayers: event.target.value }))}
            aria-label="Minimum field size"
            className="w-24"
          />
          <span className="text-muted-foreground">players</span>
        </div>
        {draft.minPlayersEnabled && !playerCountValid && (
          <FieldError>Enter a whole number of players above zero.</FieldError>
        )}
        <p className="text-muted-foreground">The threshold applies to all four sources.</p>
        {source === "uvsgames" && (
          <>
            <div className="flex items-center gap-3">
              <Switch
                id="meta-auto-accept-official"
                checked={draft.official}
                onCheckedChange={(checked: boolean) =>
                  setDraft((prev) => ({ ...prev, official: checked }))
                }
              />
              <Label htmlFor="meta-auto-accept-official">
                Publish watched event types at any size (UVS Games)
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="meta-auto-accept-notable"
                checked={draft.notable}
                onCheckedChange={(checked: boolean) =>
                  setDraft((prev) => ({ ...prev, notable: checked }))
                }
              />
              <Label htmlFor="meta-auto-accept-notable">
                Publish names with {notableNames} (UVS Games)
              </Label>
            </div>
          </>
        )}
        <p className="text-muted-foreground">
          A change applies to newly read events. Apply auto-publish rule judges the undecided ones
          again.
        </p>
        <p className="text-muted-foreground">
          Last changed {formatDayTime(settings.updatedAt)} UTC.
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave}>
          Save
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}

export function MetaAutoAcceptDialog({
  source,
  onClose,
}: {
  source: MetaSource;
  onClose: () => void;
}) {
  const { data } = useMetaSyncSettings();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {data === undefined ? (
          <>
            <DialogHeader>
              <DialogTitle>Auto-publish rule</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">Loading…</p>
          </>
        ) : (
          <AutoAcceptForm source={source} settings={data} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
