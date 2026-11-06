import { PencilIcon } from "lucide-react";

import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { WorkbenchMode } from "@/features/decks/lib/deck-editor-search";
import { m } from "@/paraglide/messages.js";

export function WorkbenchModeControl({
  mode,
  isMobile,
  onModeChange,
}: {
  mode: WorkbenchMode;
  isMobile: boolean;
  onModeChange: (mode: WorkbenchMode) => void;
}) {
  if (isMobile) {
    return mode === "build" ? (
      <PageTopBarPrimaryButton onClick={() => onModeChange("deck")}>
        {m.decks_workbench_done()}
      </PageTopBarPrimaryButton>
    ) : (
      <PageTopBarButton onClick={() => onModeChange("build")}>
        <PencilIcon className="size-4" />
        {m.decks_workbench_edit()}
      </PageTopBarButton>
    );
  }
  return (
    <ToggleGroup
      variant="control"
      spacing={0}
      value={[mode]}
      onValueChange={([next]) => {
        if (next === "build" || next === "deck") {
          onModeChange(next);
        }
      }}
      aria-label={m.decks_workbench_mode_label()}
    >
      <ToggleGroupItem value="build" className="px-3">
        {m.decks_workbench_mode_build()}
      </ToggleGroupItem>
      <ToggleGroupItem value="deck" className="px-3">
        {m.decks_workbench_mode_deck()}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
