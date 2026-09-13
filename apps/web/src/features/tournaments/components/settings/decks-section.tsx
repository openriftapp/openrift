import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import {
  combineLocalDateTimeToUtc,
  deckPhaseLabels,
  deckSubmissionItems,
  localTimeZoneLabel,
  splitUtcToLocalDateTime,
} from "@/features/tournaments/lib/tournament-display";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

export function DecksSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const updateTournament = useUpdateTournament();
  const closeInit = detail.submissionsCloseAt
    ? splitUtcToLocalDateTime(detail.submissionsCloseAt)
    : { date: "", time: "" };
  const [closeDate, setCloseDate] = useServerSeededState(closeInit.date);
  const [closeTime, setCloseTime] = useServerSeededState(closeInit.time);

  const submissionItems = deckSubmissionItems();
  const tzLabel = localTimeZoneLabel();
  const deckExpected = detail.deckSubmission !== "none";

  const closeTouched = closeDate !== "" || closeTime !== "";
  const nextCloseAt = closeTouched ? combineLocalDateTimeToUtc(closeDate, closeTime) : null;
  const closeIncomplete = closeTouched && nextCloseAt === null;
  const closeAfterEnd =
    nextCloseAt !== null &&
    detail.endsAt !== null &&
    new Date(nextCloseAt) > new Date(detail.endsAt);
  const closeInvalid = closeIncomplete || closeAfterEnd;
  const closeChanged =
    (nextCloseAt === null) !== (detail.submissionsCloseAt === null) ||
    (nextCloseAt !== null &&
      detail.submissionsCloseAt !== null &&
      new Date(nextCloseAt).getTime() !== new Date(detail.submissionsCloseAt).getTime());

  return (
    <SettingsSection
      id="decks"
      title={m.tournaments_settings_decks_title()}
      description={m.tournaments_settings_decks_description({
        phase: deckPhaseLabels()[detail.deckPhase],
      })}
      contentClassName="gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label>{m.tournaments_settings_deck_submission_label()}</Label>
        <Select
          items={submissionItems}
          value={detail.deckSubmission}
          disabled={locked || updateTournament.isPending}
          onValueChange={(value) => {
            if (value === "none" || value === "optional" || value === "required") {
              void runReportedMutation(() =>
                updateTournament.mutateAsync({ id: detail.id, deckSubmission: value }),
              );
            }
          }}
        >
          <SelectTrigger
            className="max-w-sm"
            aria-label={m.tournaments_settings_deck_submission_label()}
          >
            <SelectValue placeholder={m.tournaments_settings_deck_submission_label()} />
          </SelectTrigger>
          <SelectContent>
            {submissionItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {deckExpected ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>{m.tournaments_settings_deadline_label()}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <DatePicker
                value={closeDate}
                onChange={setCloseDate}
                onClear={() => setCloseDate("")}
                disabled={locked}
                className="w-44"
              />
              <Input
                value={closeTime}
                disabled={locked}
                onChange={(event) => setCloseTime(event.target.value)}
                placeholder="HH:mm"
                aria-label={m.tournaments_settings_deadline_time_aria()}
                className="w-24 tabular-nums"
              />
              <span className="text-muted-foreground text-sm">{tzLabel}</span>
              <Button
                disabled={locked || closeInvalid || !closeChanged || updateTournament.isPending}
                onClick={() =>
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({
                      id: detail.id,
                      submissionsCloseAt: nextCloseAt,
                    }),
                  )
                }
              >
                {m.common_save()}
              </Button>
            </div>
            {closeIncomplete ? (
              <FieldError>{m.tournaments_settings_deadline_incomplete()}</FieldError>
            ) : closeAfterEnd ? (
              <FieldError>{m.tournaments_settings_deadline_after_end()}</FieldError>
            ) : (
              <span className="text-muted-foreground text-sm">
                {m.tournaments_settings_deadline_blank_hint()}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Switch
                id="t-allow-edits"
                checked={detail.listLockMode === "at_deadline"}
                disabled={locked || updateTournament.isPending}
                onCheckedChange={(checked) =>
                  void runReportedMutation(() =>
                    updateTournament.mutateAsync({
                      id: detail.id,
                      listLockMode: checked ? "at_deadline" : "on_submit",
                    }),
                  )
                }
              />
              <Label htmlFor="t-allow-edits">{m.tournaments_settings_allow_edits_label()}</Label>
            </div>
            <span className="text-muted-foreground text-sm">
              {m.tournaments_settings_allow_edits_hint()}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{m.tournaments_settings_push_label()}</Label>
            <span className="text-muted-foreground text-sm">
              <ParaglideMessage
                message={m.tournaments_settings_push_hint}
                inputs={{ id: detail.id }}
                markup={{
                  code: ({ children }) => <code className="break-all">{children}</code>,
                  link: ({ children }) => (
                    <Link
                      to="/tournaments/$id/decks"
                      params={{ id: detail.id }}
                      className="text-foreground font-medium underline"
                    >
                      {children}
                    </Link>
                  ),
                }}
              />
            </span>
          </div>
        </>
      ) : null}
    </SettingsSection>
  );
}
