import type { CutSize } from "@openrift/shared/pairing/group-cut-types";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SwitchField } from "@/features/tournaments/components/settings/switch-field";
import { cutSizeItems, parseCutSize } from "@/features/tournaments/lib/group-cut-display";
import { m } from "@/paraglide/messages.js";

export interface GroupCutSettings {
  cutSize: CutSize;
  groupsSelfPaced: boolean;
  cutRematchAvoidance: boolean;
  legendTiebreak: boolean;
}

/** The four group-stage options; shared by the create wizard and the settings tab. */
export function GroupCutSettingsFields({
  idPrefix,
  value,
  disabled = false,
  onChange,
}: {
  idPrefix: string;
  value: GroupCutSettings;
  disabled?: boolean;
  onChange: (patch: Partial<GroupCutSettings>) => void;
}) {
  const cutItems = cutSizeItems();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-40 flex-col gap-1.5">
        <Label>{m.tournaments_group_cut_label()}</Label>
        <Select
          items={cutItems}
          value={String(value.cutSize)}
          disabled={disabled}
          onValueChange={(next) => {
            const parsed = next === null ? null : parseCutSize(next);
            if (parsed !== null) {
              onChange({ cutSize: parsed });
            }
          }}
        >
          <SelectTrigger className="w-full" aria-label={m.tournaments_group_cut_label()}>
            <SelectValue placeholder={m.tournaments_group_cut_label()} />
          </SelectTrigger>
          <SelectContent>
            {cutItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SwitchField
        id={`${idPrefix}-self-paced`}
        label={m.tournaments_group_self_paced_label()}
        hint={m.tournaments_group_self_paced_hint()}
        checked={value.groupsSelfPaced}
        disabled={disabled}
        onCheckedChange={(checked) => onChange({ groupsSelfPaced: checked })}
      />
      <SwitchField
        id={`${idPrefix}-rematch`}
        label={m.tournaments_group_rematch_label()}
        hint={m.tournaments_group_rematch_hint()}
        checked={value.cutRematchAvoidance}
        disabled={disabled}
        onCheckedChange={(checked) => onChange({ cutRematchAvoidance: checked })}
      />
      <SwitchField
        id={`${idPrefix}-legend-tiebreak`}
        label={m.tournaments_group_legend_tiebreak_label()}
        hint={m.tournaments_group_legend_tiebreak_hint()}
        checked={value.legendTiebreak}
        disabled={disabled}
        onCheckedChange={(checked) => onChange({ legendTiebreak: checked })}
      />
    </div>
  );
}
