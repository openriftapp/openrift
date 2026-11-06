import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Switch } from "@/components/ui/switch";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useSetOwnFeatureFlag } from "@/hooks/use-own-feature-flag";
import { m } from "@/paraglide/messages.js";

export function BetaFeaturesSection() {
  const deckBuilderBeta = useFeatureEnabled("deck-builder-beta");
  const setOwnFlag = useSetOwnFeatureFlag();

  return (
    <SettingsSection
      id="beta"
      title={m.profile_beta_title()}
      description={m.profile_beta_description()}
    >
      <SettingsRow
        label={m.profile_beta_deck_builder_label()}
        htmlFor="pref-beta-deck-builder"
        description={m.profile_beta_deck_builder_description()}
      >
        <Switch
          id="pref-beta-deck-builder"
          checked={deckBuilderBeta}
          disabled={setOwnFlag.isPending}
          onCheckedChange={(checked: boolean) =>
            setOwnFlag.mutate({ key: "deck-builder-beta", enabled: checked })
          }
        />
      </SettingsRow>
    </SettingsSection>
  );
}
