import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { parseUvsgamesEventId, uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";
import { ExternalLinkIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
import { useUvsgamesSuggestions } from "@/features/tournaments/hooks/use-tournament-archive-lists";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function UvsgamesSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const [input, setInput] = useServerSeededState(detail.uvsgamesEventId ?? "");
  const { data: suggestions } = useUvsgamesSuggestions(detail.id, detail.groupId !== null);
  const parsed = parseUvsgamesEventId(input);
  const invalid = input.trim() !== "" && parsed === null;
  const changed = parsed !== null && parsed !== detail.uvsgamesEventId;

  const save = (uvsgamesEventId: string | null) => {
    void runReportedMutation(() =>
      updateTournament.mutateAsync({ id: detail.id, uvsgamesEventId }),
    );
  };

  const offered = (suggestions ?? []).filter(
    (suggestion) => suggestion.externalId !== detail.uvsgamesEventId,
  );

  return (
    <SettingsSection
      id="uvsgames"
      title={m.tournaments_settings_uvsgames_title()}
      description={m.tournaments_settings_uvsgames_description()}
      contentClassName="gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tournament-uvsgames-event">{m.tournaments_settings_uvsgames_label()}</Label>
        <Input
          id="tournament-uvsgames-event"
          value={input}
          disabled={locked}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://locator.riftbound.uvsgames.com/events/…"
          aria-invalid={invalid || undefined}
        />
        {invalid ? <FieldError>{m.tournaments_settings_uvsgames_invalid()}</FieldError> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={locked || !changed || updateTournament.isPending}
          onClick={() => save(parsed)}
        >
          {m.tournaments_settings_uvsgames_save()}
        </Button>
        {detail.uvsgamesEventId === null ? null : (
          <Button
            variant="secondary"
            disabled={locked || updateTournament.isPending}
            onClick={() => {
              setInput("");
              save(null);
            }}
          >
            {m.tournaments_settings_uvsgames_remove()}
          </Button>
        )}
        {detail.uvsgamesEventId === null ? null : (
          <TextLink
            href={uvsgamesEventUrl(detail.uvsgamesEventId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
          >
            {m.tournaments_settings_uvsgames_open()}
            <ExternalLinkIcon className="size-3.5" />
          </TextLink>
        )}
      </div>
      {offered.length > 0 && !locked ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {m.tournaments_settings_uvsgames_suggestions()}
          </p>
          <RowList>
            {offered.map((suggestion) => (
              <RowListItem key={suggestion.externalId} className="justify-between">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{suggestion.name}</span>
                  <span className="text-muted-foreground truncate text-sm">
                    {suggestion.storeName} · {formatDayTimeLocal(suggestion.startAt)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updateTournament.isPending}
                  onClick={() => {
                    setInput(suggestion.externalId);
                    save(suggestion.externalId);
                  }}
                >
                  {m.tournaments_settings_uvsgames_use()}
                </Button>
              </RowListItem>
            ))}
          </RowList>
        </div>
      ) : null}
    </SettingsSection>
  );
}
