import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/ui/text-link";
import { SaveError } from "@/features/tournaments/components/save-error";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export type EventLinkField = "uvsgamesEventId" | "playriftboundEventId";

export interface EventLinkLabels {
  title: string;
  description: string;
  label: string;
  invalid: string;
  save: string;
  remove: string;
  open: string;
}

export function EventLinkSection({
  id,
  tournamentId,
  field,
  linkedId,
  parse,
  eventUrl,
  placeholder,
  labels,
  locked,
  children,
}: {
  id: string;
  tournamentId: string;
  field: EventLinkField;
  linkedId: string | null;
  parse: (input: string) => string | null;
  eventUrl: (eventId: string) => string;
  placeholder: string;
  labels: EventLinkLabels;
  locked: boolean;
  children?: (link: (eventId: string) => void, pending: boolean) => ReactNode;
}) {
  const updateTournament = useUpdateTournament();
  const [input, setInput] = useServerSeededState(linkedId ?? "");
  const parsed = parse(input);
  const invalid = input.trim() !== "" && parsed === null;
  const changed = parsed !== null && parsed !== linkedId;
  const inputId = `tournament-${id}-event`;

  const save = (eventId: string | null) => {
    void runReportedMutation(() =>
      updateTournament.mutateAsync({ id: tournamentId, [field]: eventId }),
    );
  };

  return (
    <SettingsSection
      id={id}
      title={labels.title}
      description={labels.description}
      contentClassName="gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{labels.label}</Label>
        <Input
          id={inputId}
          value={input}
          disabled={locked}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
        />
        {invalid ? <FieldError>{labels.invalid}</FieldError> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={locked || !changed || updateTournament.isPending}
          onClick={() => save(parsed)}
        >
          {labels.save}
        </Button>
        {linkedId === null ? null : (
          <Button
            variant="secondary"
            disabled={locked || updateTournament.isPending}
            onClick={() => {
              setInput("");
              save(null);
            }}
          >
            {labels.remove}
          </Button>
        )}
        {linkedId === null ? null : (
          <TextLink
            href={eventUrl(linkedId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1"
          >
            {labels.open}
            <ExternalLinkIcon className="size-3.5" />
          </TextLink>
        )}
      </div>
      <SaveError error={updateTournament.error} />
      {locked
        ? null
        : children?.((eventId) => {
            setInput(eventId);
            save(eventId);
          }, updateTournament.isPending)}
    </SettingsSection>
  );
}
