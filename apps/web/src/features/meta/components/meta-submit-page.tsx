import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import type { MetaEventSummary, MetaSubmissionResult } from "@openrift/shared/types/api/meta";
import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { SettingsSection } from "@/components/layout/settings-section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useMetaEvents } from "@/features/meta/hooks/use-meta";
import type { MetaSubmissionOutcome } from "@/features/meta/hooks/use-meta-submissions";
import { useSubmitMetaDeck } from "@/features/meta/hooks/use-meta-submissions";
import { formatRank, formatRecord } from "@/features/meta/lib/meta-format";
import {
  metaSubmissionCompletenessLabels,
  metaSubmissionFormTitles,
} from "@/features/meta/lib/meta-submission-copy";
import type {
  MetaSubmissionDraft,
  MetaSubmissionParsedList,
  MetaSubmissionPrefill,
} from "@/features/meta/lib/meta-submission-form";
import {
  buildMetaSubmissionInput,
  metaSubmissionDraftFromPrefill,
  metaSubmissionLegendMismatch,
  parseMetaSubmissionList,
  validateMetaSubmissionDraft,
} from "@/features/meta/lib/meta-submission-form";
import { useDeckFormatList } from "@/hooks/use-enums";
import { cn, FORM_COLUMN, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const DECK_PLACEHOLDER = `Legend:
1 Emperor of the Sands

Champion:
1 Azir, Sovereign

MainDeck:
3 Arise!
3 Soul Sword

Battlefields:
1 Seat of Power`;

function joinMissing(parts: readonly string[]): string {
  if (parts.length <= 1) {
    return parts.join("");
  }
  return m.meta_submit_join_or({
    parts: parts.slice(0, -1).join(", "),
    last: parts.at(-1) ?? "",
  });
}

function partialListSentence(parsed: MetaSubmissionParsedList): string {
  const missing: string[] = [];
  if (parsed.legend === null) {
    missing.push(m.meta_submit_missing_legend());
  }
  if (parsed.zones.battlefield === 0) {
    missing.push(m.meta_submit_missing_battlefields());
  }
  if (parsed.zones.runes === 0) {
    missing.push(m.meta_submit_missing_runes());
  }
  const tail =
    missing.length === 1 ? m.meta_submit_partial_tail_one() : m.meta_submit_partial_tail_other();
  return m.meta_submit_partial_sentence({ missing: joinMissing(missing), tail });
}

function parsedList(text: string, allPrintings: Printing[]): MetaSubmissionParsedList | null {
  return text.trim() === "" ? null : parseMetaSubmissionList(text, allPrintings);
}

function finishLabel(rank: number | undefined, rankIsTier: boolean | undefined): string | null {
  if (rank === undefined) {
    return null;
  }
  return rankIsTier === true ? formatRank(rank, true) : `#${rank}`;
}

function eventFacts(event: MetaEventSummary, formatLabel: string): string {
  const facts = [formatDay(event.eventDate), formatLabel];
  if (event.playerCount !== null) {
    facts.push(
      event.playerCount === 1
        ? m.meta_submit_players_one({ count: String(event.playerCount) })
        : m.meta_submit_players_other({ count: String(event.playerCount) }),
    );
  }
  return facts.join(" · ");
}

function LegendCheck({
  parsed,
  prefill,
}: {
  parsed: MetaSubmissionParsedList;
  prefill: MetaSubmissionPrefill;
}) {
  if (prefill.legendCardId === undefined || parsed.legend === null) {
    return null;
  }
  if (!metaSubmissionLegendMismatch(parsed, prefill.legendCardId)) {
    return <p className="text-muted-foreground text-sm">{m.meta_submit_legend_matches()}</p>;
  }
  return (
    <Alert variant="info">
      <AlertTitle>
        {m.meta_submit_legend_mismatch({
          listLegend: parsed.legend.cardName,
          standingsLegend: prefill.legendName ?? "",
        })}
      </AlertTitle>
      <AlertDescription>{m.meta_submit_legend_mismatch_hint()}</AlertDescription>
    </Alert>
  );
}

function ListReadback({
  parsed,
  prefill,
}: {
  parsed: MetaSubmissionParsedList;
  prefill: MetaSubmissionPrefill;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={parsed.listStatus === "full" ? "success" : "muted"}>
          {metaSubmissionCompletenessLabels()[parsed.listStatus]}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {m.meta_submit_main_count({ count: String(parsed.zones.main) })} ·{" "}
          {parsed.zones.battlefield === 1
            ? m.meta_submit_battlefields_one({ count: String(parsed.zones.battlefield) })
            : m.meta_submit_battlefields_other({ count: String(parsed.zones.battlefield) })}{" "}
          ·{" "}
          {parsed.zones.runes === 1
            ? m.meta_submit_runes_one({ count: String(parsed.zones.runes) })
            : m.meta_submit_runes_other({ count: String(parsed.zones.runes) })}
        </span>
      </div>

      {parsed.listStatus === "partial" && (
        <p className="text-muted-foreground text-sm">{partialListSentence(parsed)}</p>
      )}

      <LegendCheck parsed={parsed} prefill={prefill} />

      {parsed.reinterpreted.length > 0 && (
        <Alert variant="info">
          <AlertTitle>{m.meta_submit_reinterpreted_title()}</AlertTitle>
          <AlertDescription>
            <ul className="list-outside list-disc pl-4">
              {parsed.reinterpreted.map((row) => (
                <li key={row.source}>
                  {row.source} → {row.matched}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {parsed.unmatched.length > 0 && (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>
            {parsed.unmatched.length === 1
              ? m.meta_submit_unmatched_one()
              : m.meta_submit_unmatched_other({ count: String(parsed.unmatched.length) })}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-outside list-disc pl-4">
              {parsed.unmatched.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p>{m.meta_submit_unmatched_hint()}</p>
          </AlertDescription>
        </Alert>
      )}

      {parsed.warnings.length > 0 && (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>{m.meta_submit_skipped_title()}</AlertTitle>
          <AlertDescription>
            <ul className="list-outside list-disc pl-4">
              {parsed.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SubmissionSent({
  result,
  eventSlug,
  onSendAnother,
}: {
  result: MetaSubmissionResult;
  eventSlug?: string;
  onSendAnother: () => void;
}) {
  const unresolved = result.unresolvedNames;
  const showRetry = eventSlug === undefined || unresolved.length > 0;
  return (
    <div className="flex flex-col gap-4">
      {unresolved.length === 0 ? (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>{m.meta_submit_sent_title()}</AlertTitle>
          <AlertDescription>{m.meta_submit_sent_description()}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>
            {unresolved.length === 1
              ? m.meta_submit_unresolved_one()
              : m.meta_submit_unresolved_other({ count: String(unresolved.length) })}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-outside list-disc pl-4">
              {unresolved.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p>{m.meta_submit_unresolved_hint()}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {eventSlug !== undefined && (
          <Button render={<Link to="/meta/$slug" params={{ slug: eventSlug }} />}>
            {m.meta_submit_back_to_standings()}
          </Button>
        )}
        <Button
          variant={eventSlug === undefined ? "default" : "outline"}
          render={<Link to="/meta/submissions" />}
        >
          {m.meta_submissions_title()}
        </Button>
        {showRetry && (
          <Button variant="outline" onClick={onSendAnother}>
            {unresolved.length === 0
              ? m.meta_submit_send_another()
              : m.meta_submit_fix_and_resend()}
          </Button>
        )}
      </div>
    </div>
  );
}

export function MetaSubmitPage({
  slug,
  prefill,
}: {
  slug?: string;
  prefill?: MetaSubmissionPrefill;
}) {
  const { data: eventsData } = useMetaEvents();
  const { allPrintings } = useCards();
  const { formats, labels: formatLabels } = useDeckFormatList();
  const submit = useSubmitMetaDeck();

  const events = eventsData.events;
  const eventFromSlug = slug === undefined ? undefined : events.find((row) => row.slug === slug);
  const row = prefill ?? {};

  const [draft, setDraft] = useState<MetaSubmissionDraft>(() =>
    metaSubmissionDraftFromPrefill(row),
  );
  const [selectedEventId, setSelectedEventId] = useState<string>(eventFromSlug?.id ?? "");
  const [proposing, setProposing] = useState(eventFromSlug === undefined && events.length === 0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<MetaSubmissionResult | null>(null);

  const deferredDeckText = useDeferredValue(draft.deckText);
  const parsed = parsedList(deferredDeckText, allPrintings);

  const lockedToEvent = eventFromSlug !== undefined;
  const fromRow = lockedToEvent && row.playerName !== undefined && row.rank !== undefined;
  // A proposed tournament is one the archive has never seen, so there is
  // nothing to complete or correct whatever link got the sender here.
  const kind = proposing ? "new_list" : draft.kind;
  const startedFromArchivedList = draft.kind !== "new_list" && (row.deckText ?? "") !== "";
  const noteExpanded = noteOpen || kind === "correction";

  function set<TKey extends keyof MetaSubmissionDraft>(
    key: TKey,
    value: MetaSubmissionDraft[TKey],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function applyOutcome(outcome: MetaSubmissionOutcome) {
    if (!outcome.ok) {
      setFormError(outcome.message);
      return;
    }
    setResult(outcome.result);
  }

  async function handleSubmit() {
    const problem = validateMetaSubmissionDraft(draft, {
      proposing,
      cardCount: parsed?.cards.length ?? 0,
    });
    if (problem) {
      setFormError(problem);
      return;
    }
    if (!proposing && selectedEventId === "") {
      setFormError(m.meta_submit_error_pick_event());
      return;
    }
    if (parsed === null) {
      setFormError(m.meta_validate_paste_decklist());
      return;
    }

    const target = proposing ? null : { metaEventId: selectedEventId };
    const input = buildMetaSubmissionInput(draft, parsed, target);
    setFormError("");
    try {
      applyOutcome(await submit.mutateAsync(input));
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  function handleSendAnother() {
    setResult(null);
  }

  const eventItems: Record<string, string> = {};
  for (const event of events) {
    eventItems[event.id] = `${event.name} · ${formatDay(event.eventDate)}`;
  }

  const formatItems: Record<string, string> = {};
  for (const format of formats) {
    formatItems[format.slug] = format.label;
  }

  const record = formatRecord(row.wins ?? null, row.losses ?? null, row.draws ?? null);
  const finish = finishLabel(row.rank, row.rankIsTier);
  const cancelSlug = lockedToEvent ? slug : undefined;
  const deckHint = startedFromArchivedList
    ? m.meta_submit_deck_hint_archived()
    : m.meta_submit_deck_hint_default();

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          {cancelSlug === undefined ? (
            <PageTopBarBack to="/meta" />
          ) : (
            <PageTopBarBack to="/meta/$slug" params={{ slug: cancelSlug }} />
          )}
          <PageTopBarTitle>{metaSubmissionFormTitles()[kind]}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarButton render={<Link to="/meta/submissions" />}>
              {m.meta_submissions_title()}
            </PageTopBarButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        {result ? (
          <SubmissionSent
            result={result}
            eventSlug={fromRow ? cancelSlug : undefined}
            onSendAnother={handleSendAnother}
          />
        ) : (
          <>
            <div className="flex flex-col gap-8">
              {fromRow && eventFromSlug ? (
                <SettingsSection
                  title={eventFromSlug.name}
                  description={eventFacts(
                    eventFromSlug,
                    enumLabel(formatLabels, eventFromSlug.format),
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{row.playerName}</span>
                    {finish !== null && <Badge variant="outline">{finish}</Badge>}
                    {record !== null && (
                      <span className="text-muted-foreground tabular-nums">{record}</span>
                    )}
                    {row.legendName !== undefined && (
                      <span className="text-muted-foreground">
                        {m.meta_submit_row_legend({ name: row.legendName })}
                      </span>
                    )}
                  </div>
                </SettingsSection>
              ) : null}

              {!fromRow && (
                <>
                  <SettingsSection
                    title={m.meta_submit_section_tournament()}
                    description={
                      lockedToEvent
                        ? m.meta_submit_section_tournament_locked()
                        : m.meta_submit_section_tournament_pick()
                    }
                  >
                    <FieldGroup className={FORM_COLUMN}>
                      {lockedToEvent && eventFromSlug ? (
                        <Field>
                          <p className="font-medium">{eventFromSlug.name}</p>
                          <FieldDescription>
                            {eventFacts(
                              eventFromSlug,
                              enumLabel(formatLabels, eventFromSlug.format),
                            )}
                          </FieldDescription>
                        </Field>
                      ) : null}

                      {!lockedToEvent && !proposing ? (
                        <Field>
                          <FieldLabel htmlFor="meta-submit-event">
                            {m.meta_submit_event_label()}
                          </FieldLabel>
                          <Select
                            items={eventItems}
                            value={selectedEventId}
                            onValueChange={(value) => setSelectedEventId((value as string) ?? "")}
                          >
                            <SelectTrigger id="meta-submit-event" className="w-full">
                              <SelectValue placeholder={m.meta_submit_event_placeholder()} />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(eventItems).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FieldDescription>
                            <Button
                              type="button"
                              variant="link-muted"
                              size="sm"
                              className="h-auto p-0"
                              onClick={() => setProposing(true)}
                            >
                              {m.meta_submit_event_missing_link()}
                            </Button>
                          </FieldDescription>
                        </Field>
                      ) : null}

                      {!lockedToEvent && proposing ? (
                        <>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-name">
                              {m.meta_submit_event_name()}
                            </FieldLabel>
                            <Input
                              id="meta-submit-event-name"
                              value={draft.eventName}
                              maxLength={120}
                              placeholder="Summoner Skirmish"
                              onChange={(event) => set("eventName", event.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-date">
                              {m.meta_submit_event_date()}
                            </FieldLabel>
                            <DatePicker
                              value={draft.eventDate}
                              onChange={(iso) => set("eventDate", iso)}
                              onClear={() => set("eventDate", "")}
                              className="w-full"
                            />
                            <FieldDescription>{m.meta_submit_event_date_hint()}</FieldDescription>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-format">
                              {m.meta_submit_event_format()}
                            </FieldLabel>
                            <Select
                              items={formatItems}
                              value={draft.eventFormat}
                              onValueChange={(value) => set("eventFormat", (value as string) ?? "")}
                            >
                              <SelectTrigger id="meta-submit-event-format" className="w-full">
                                <SelectValue
                                  placeholder={m.meta_submit_event_format_placeholder()}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(formatItems).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-players">
                              {m.meta_submit_event_players()}
                            </FieldLabel>
                            <Input
                              id="meta-submit-event-players"
                              inputMode="numeric"
                              value={draft.eventPlayerCount}
                              placeholder="64"
                              onChange={(event) => set("eventPlayerCount", event.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-organizer">
                              {m.meta_submit_event_organizer()}
                            </FieldLabel>
                            <Input
                              id="meta-submit-event-organizer"
                              value={draft.eventOrganizer}
                              maxLength={120}
                              placeholder="Rift Games Berlin"
                              onChange={(event) => set("eventOrganizer", event.target.value)}
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="meta-submit-event-source">
                              {m.meta_submit_event_source()}
                            </FieldLabel>
                            <Input
                              id="meta-submit-event-source"
                              value={draft.eventSourceUrl}
                              maxLength={2000}
                              placeholder={m.meta_submit_event_source_placeholder()}
                              onChange={(event) => set("eventSourceUrl", event.target.value)}
                            />
                            <FieldDescription>{m.meta_submit_event_source_hint()}</FieldDescription>
                          </Field>
                          <Field>
                            <FieldDescription>
                              <Button
                                type="button"
                                variant="link-muted"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => setProposing(false)}
                              >
                                {m.meta_submit_event_pick_existing()}
                              </Button>
                            </FieldDescription>
                          </Field>
                        </>
                      ) : null}
                    </FieldGroup>
                  </SettingsSection>

                  <SettingsSection title={m.meta_submit_section_player()}>
                    <FieldGroup className={FORM_COLUMN}>
                      <Field>
                        <FieldLabel htmlFor="meta-submit-player">
                          {m.meta_submit_player_label()}
                        </FieldLabel>
                        <Input
                          id="meta-submit-player"
                          value={draft.playerName}
                          maxLength={80}
                          placeholder={m.meta_submit_player_placeholder()}
                          onChange={(event) => set("playerName", event.target.value)}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="meta-submit-rank">
                          {m.meta_submit_rank_label()}
                        </FieldLabel>
                        <Input
                          id="meta-submit-rank"
                          inputMode="numeric"
                          value={draft.rank}
                          placeholder="1"
                          className="w-24"
                          onChange={(event) => set("rank", event.target.value)}
                        />
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id="meta-submit-rank-is-tier"
                            checked={draft.rankIsTier}
                            onCheckedChange={(checked) => set("rankIsTier", checked === true)}
                            className="mt-0.5"
                          />
                          <label htmlFor="meta-submit-rank-is-tier" className="cursor-pointer">
                            <span className="block">{m.meta_submit_rank_is_tier()}</span>
                            <span className="text-muted-foreground block text-sm">
                              {m.meta_submit_rank_is_tier_hint()}
                            </span>
                          </label>
                        </div>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="meta-submit-wins">
                          {m.meta_submit_record_label()}
                        </FieldLabel>
                        <div className="flex items-center gap-2">
                          <Input
                            id="meta-submit-wins"
                            inputMode="numeric"
                            value={draft.wins}
                            placeholder={m.meta_submit_record_wins_placeholder()}
                            aria-label={m.meta_submit_record_wins_aria()}
                            className="w-16"
                            onChange={(event) => set("wins", event.target.value)}
                          />
                          <Input
                            inputMode="numeric"
                            value={draft.losses}
                            placeholder={m.meta_submit_record_losses_placeholder()}
                            aria-label={m.meta_submit_record_losses_aria()}
                            className="w-16"
                            onChange={(event) => set("losses", event.target.value)}
                          />
                          <Input
                            inputMode="numeric"
                            value={draft.draws}
                            placeholder={m.meta_submit_record_draws_placeholder()}
                            aria-label={m.meta_submit_record_draws_aria()}
                            className="w-16"
                            onChange={(event) => set("draws", event.target.value)}
                          />
                        </div>
                        <FieldDescription>{m.meta_submit_record_hint()}</FieldDescription>
                      </Field>
                    </FieldGroup>
                  </SettingsSection>
                </>
              )}

              <SettingsSection title={m.meta_submit_section_decklist()}>
                <Field className="max-w-2xl">
                  <FieldLabel htmlFor="meta-submit-deck">
                    {m.meta_submit_section_decklist()}
                  </FieldLabel>
                  <Textarea
                    id="meta-submit-deck"
                    value={draft.deckText}
                    rows={12}
                    className="font-mono text-sm"
                    placeholder={DECK_PLACEHOLDER}
                    onChange={(event) => set("deckText", event.target.value)}
                  />
                  <FieldDescription>{deckHint}</FieldDescription>
                </Field>

                {parsed && parsed.cards.length > 0 ? (
                  <ListReadback parsed={parsed} prefill={row} />
                ) : null}

                {noteExpanded ? (
                  <Field className="max-w-2xl">
                    <FieldLabel htmlFor="meta-submit-note">
                      {kind === "correction"
                        ? m.meta_submit_note_correction_label()
                        : m.meta_submit_note_label()}
                    </FieldLabel>
                    <Textarea
                      id="meta-submit-note"
                      value={draft.note}
                      rows={3}
                      maxLength={2000}
                      placeholder={
                        kind === "correction"
                          ? m.meta_submit_note_correction_placeholder()
                          : m.meta_submit_note_placeholder()
                      }
                      onChange={(event) => set("note", event.target.value)}
                    />
                  </Field>
                ) : (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto self-start p-0"
                    onClick={() => setNoteOpen(true)}
                  >
                    {m.meta_submit_note_add()}
                  </Button>
                )}
              </SettingsSection>
            </div>
            {formError ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>{formError}</AlertTitle>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={submit.isPending || parsed === null || parsed.cards.length === 0}
                onClick={() => void handleSubmit()}
              >
                {submit.isPending ? m.meta_submit_sending() : m.meta_submit_send()}
              </Button>
              {cancelSlug === undefined ? (
                <Button variant="outline" render={<Link to="/meta" />}>
                  {m.common_cancel()}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  render={<Link to="/meta/$slug" params={{ slug: cancelSlug }} />}
                >
                  {m.common_cancel()}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
