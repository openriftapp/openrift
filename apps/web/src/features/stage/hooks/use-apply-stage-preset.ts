import { useEffect } from "react";

import { useStagePresets } from "@/features/stage/hooks/use-stage-presets";
import { useAppliedStagePresetStore } from "@/features/stage/stores/applied-stage-preset-store";
import { applyStagePresetConfig } from "@/features/stage/stores/stage-preset-actions";

/**
 * Applies the URL's preset once per page load, even across the builder and the show: re-applying
 * would undo switches flipped since. An id that does not resolve is dropped silently.
 */
export function useApplyStagePreset(preset: string | undefined) {
  const { data: presets } = useStagePresets();

  useEffect(() => {
    if (preset === undefined || presets === undefined) {
      return;
    }
    const applied = useAppliedStagePresetStore.getState();
    if (applied.appliedIds.includes(preset)) {
      return;
    }
    applied.markApplied(preset);
    const found = presets.find((candidate) => candidate.id === preset);
    if (found) {
      applyStagePresetConfig(found.config);
    }
  }, [preset, presets]);
}
