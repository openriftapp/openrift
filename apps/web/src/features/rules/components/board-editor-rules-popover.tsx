import type { RuleRefKind } from "@openrift/shared/board-state";
import { useQuery } from "@tanstack/react-query";
import { SettingsIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { m } from "@/paraglide/messages.js";

function RulesPinField({
  kind,
  label,
  value,
  onChange,
}: {
  kind: RuleRefKind;
  label: string;
  value: string | null;
  onChange: (version: string | null) => void;
}) {
  const versions = useQuery(ruleVersionsQueryOptions(kind)).data?.versions ?? [];
  const latest = versions.at(-1)?.version ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center justify-between gap-2">
        {label}
        <Switch
          checked={value !== null}
          disabled={latest === null}
          onCheckedChange={(checked) => onChange(checked ? latest : null)}
        />
      </Label>
      {value === null ? null : (
        <Select
          value={value}
          onValueChange={(next) => {
            if (typeof next === "string") {
              onChange(next);
            }
          }}
        >
          <SelectTrigger className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.toReversed().map((entry) => (
              <SelectItem key={entry.version} value={entry.version}>
                {entry.version}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function BoardEditorRulesPopover({
  coreRulesVersion,
  tournamentRulesVersion,
  onChange,
}: {
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
  onChange: (pins: {
    coreRulesVersion: string | null;
    tournamentRulesVersion: string | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const off = m.board_states_editor_rules_off();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<PageTopBarButton />}>
        <SettingsIcon />
        {m.board_states_editor_settings()}
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3">
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{m.board_states_editor_rules_version()}</span>
          <span className="text-muted-foreground text-sm">
            {m.board_states_editor_rules_summary({
              core: coreRulesVersion ?? off,
              tournament: tournamentRulesVersion ?? off,
            })}
          </span>
        </span>
        <RulesPinField
          kind="core"
          label={m.board_states_editor_core_rules()}
          value={coreRulesVersion}
          onChange={(next) => onChange({ coreRulesVersion: next, tournamentRulesVersion })}
        />
        <RulesPinField
          kind="tournament"
          label={m.board_states_editor_tournament_rules()}
          value={tournamentRulesVersion}
          onChange={(next) => onChange({ coreRulesVersion, tournamentRulesVersion: next })}
        />
      </PopoverContent>
    </Popover>
  );
}
