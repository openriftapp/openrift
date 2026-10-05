import type { TournamentPlayMode } from "@openrift/shared/types/api/tournament";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TournamentRoundsChoice } from "@/features/tournaments/lib/tournament-display";
import {
  isGroupCutChoice,
  PLAY_MODE_ITEMS,
  roundsChoiceItems,
} from "@/features/tournaments/lib/tournament-display";
import { m } from "@/paraglide/messages.js";

/** A group-cut tournament is 1v1 only. */
export function PlayModeField({
  value,
  groupCut,
  disabled = false,
  onChange,
}: {
  value: TournamentPlayMode;
  groupCut: boolean;
  disabled?: boolean;
  onChange: (value: TournamentPlayMode) => void;
}) {
  const items = groupCut ? PLAY_MODE_ITEMS.filter((item) => item.value === "1v1") : PLAY_MODE_ITEMS;
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{m.tournaments_settings_play_mode_label()}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const match = items.find((item) => item.value === next);
          if (match && match.value !== value) {
            onChange(match.value);
          }
        }}
      >
        <SelectTrigger className="w-full" aria-label={m.tournaments_settings_play_mode_label()}>
          <SelectValue placeholder={m.tournaments_settings_play_mode_label()} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** 2v2 pairs team Swiss: pods and the group cut don't compose with fixed teams. */
export function RoundsField({
  value,
  teams,
  disabled = false,
  onChange,
}: {
  value: TournamentRoundsChoice;
  teams: boolean;
  disabled?: boolean;
  onChange: (value: TournamentRoundsChoice) => void;
}) {
  const items = roundsChoiceItems().filter(
    (item) => !teams || (item.value !== "pod" && !isGroupCutChoice(item.value)),
  );
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{m.tournaments_settings_rounds_label()}</Label>
      <Select
        items={items}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const match = items.find((item) => item.value === next);
          if (match && match.value !== value) {
            onChange(match.value);
          }
        }}
      >
        <SelectTrigger className="w-full" aria-label={m.tournaments_settings_rounds_label()}>
          <SelectValue placeholder={m.tournaments_settings_rounds_label()} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
