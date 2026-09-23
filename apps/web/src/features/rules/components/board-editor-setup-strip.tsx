import type { BoardZoneVisibility } from "@openrift/shared/board-state";
import { MAX_BATTLEFIELDS } from "@openrift/shared/board-state";
import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { m } from "@/paraglide/messages.js";

const ZONE_TOGGLES: { key: keyof BoardZoneVisibility; label: () => string }[] = [
  { key: "legend", label: m.board_states_zone_legend },
  { key: "champion", label: m.board_states_zone_champion },
  { key: "base", label: m.board_states_zone_base },
  { key: "runes", label: m.board_states_zone_runes },
  { key: "hand", label: m.board_states_zone_hand },
  { key: "deck", label: m.board_states_zone_deck },
  { key: "trash", label: m.board_states_zone_trash },
  { key: "chain", label: m.board_states_chain },
];

function CountGroup({
  label,
  counts,
  value,
  onChange,
}: {
  label: string;
  counts: number[];
  value: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <ToggleGroup
        size="sm"
        variant="outline"
        spacing={0}
        value={[String(value)]}
        onValueChange={(next) => {
          const first = next[0];
          if (first !== undefined) {
            onChange(Number(first));
          }
        }}
      >
        {counts.map((count) => (
          <ToggleGroupItem key={count} value={String(count)}>
            {count}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

export function BoardEditorSetupStrip() {
  const playerCount = useBoardEditorStore((state) => state.document.playerCount);
  const battlefieldCount = useBoardEditorStore((state) => state.document.battlefields.length);
  const zones = useBoardEditorStore((state) => state.document.zones);
  const setPlayerCount = useBoardEditorStore((state) => state.setPlayerCount);
  const setBattlefieldCount = useBoardEditorStore((state) => state.setBattlefieldCount);
  const setZoneVisible = useBoardEditorStore((state) => state.setZoneVisible);
  const visibleZones = ZONE_TOGGLES.filter((toggle) => zones[toggle.key]).map(
    (toggle) => toggle.key as string,
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover>
        <PopoverTrigger render={<Button variant="outline" />}>
          <SlidersHorizontalIcon />
          {m.board_states_editor_table_setup()}
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-80 flex-col gap-4">
          <CountGroup
            label={m.board_states_editor_players()}
            counts={[2, 3, 4]}
            value={playerCount}
            onChange={setPlayerCount}
          />
          <CountGroup
            label={m.board_states_editor_battlefields()}
            counts={Array.from({ length: MAX_BATTLEFIELDS }, (_, index) => index + 1)}
            value={battlefieldCount}
            onChange={setBattlefieldCount}
          />
          <div className="flex flex-col gap-2">
            <Label>{m.board_states_editor_zones()}</Label>
            <ToggleGroup
              size="sm"
              variant="outline"
              multiple
              value={visibleZones}
              onValueChange={(value) => {
                const next = new Set(value);
                for (const toggle of ZONE_TOGGLES) {
                  const visible = next.has(toggle.key);
                  if (visible !== zones[toggle.key]) {
                    setZoneVisible(toggle.key, visible);
                  }
                }
              }}
              className="flex-wrap"
            >
              {ZONE_TOGGLES.map((toggle) => (
                <ToggleGroupItem key={toggle.key} value={toggle.key}>
                  {toggle.label()}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
