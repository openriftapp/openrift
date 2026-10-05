import { SettingsSection } from "@/components/layout/settings-section";
import { OrderedToggleList } from "@/features/account/components/ordered-toggle-list";
import { m } from "@/paraglide/messages.js";
import { useDisplayStore } from "@/stores/display-store";

import { ResetButton } from "./reset-button";

export function LanguagesSection({
  availableLanguages,
}: {
  availableLanguages: { code: string; name: string }[];
}) {
  const languages = useDisplayStore((s) => s.languages);
  const setLanguages = useDisplayStore((s) => s.setLanguages);
  const overrides = useDisplayStore((s) => s.overrides);
  const resetPreference = useDisplayStore((s) => s.resetPreference);

  if (availableLanguages.length === 0) {
    return null;
  }

  return (
    <SettingsSection
      id="languages"
      title={m.profile_languages_title()}
      description={m.profile_languages_description()}
      action={
        overrides.languages !== null && (
          <ResetButton
            onClick={() => resetPreference("languages")}
            label={m.profile_languages_reset()}
          />
        )
      }
    >
      <OrderedToggleList
        idPrefix="pref-lang"
        order={languages}
        options={availableLanguages.map((lang) => ({
          value: lang.code,
          label: lang.name,
          meta: lang.code,
        }))}
        onChange={setLanguages}
        firstBadge={m.profile_languages_preferred()}
        moveUpLabel={(name) => m.profile_languages_move_up({ name })}
        moveDownLabel={(name) => m.profile_languages_move_down({ name })}
      />
    </SettingsSection>
  );
}
