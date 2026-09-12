import { Radio } from "@base-ui/react/radio";
import type {
  DefaultCardView,
  DisplayLocale,
  Palette,
  Theme,
} from "@openrift/shared/types/api/preferences";
import { DISPLAY_LOCALES, PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { RadioGroup } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { persistDisplayLocale } from "@/features/account/hooks/use-preferences-sync";
import { usePaletteStore } from "@/features/collections/stores/palette-store";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { getLocale, setLocale } from "@/paraglide/runtime.js";
import { useDisplayStore } from "@/stores/display-store";
import { useThemeStore } from "@/stores/theme-store";

import { ResetButton } from "./reset-button";

export function DisplaySection() {
  const showImages = useDisplayStore((s) => s.showImages);
  const setShowImages = useDisplayStore((s) => s.setShowImages);
  const fancyFan = useDisplayStore((s) => s.fancyFan);
  const setFancyFan = useDisplayStore((s) => s.setFancyFan);
  const foilEffect = useDisplayStore((s) => s.foilEffect);
  const setFoilEffect = useDisplayStore((s) => s.setFoilEffect);
  const cardTilt = useDisplayStore((s) => s.cardTilt);
  const setCardTilt = useDisplayStore((s) => s.setCardTilt);
  const frostedBars = useDisplayStore((s) => s.frostedBars);
  const setFrostedBars = useDisplayStore((s) => s.setFrostedBars);
  const defaultCardView = useDisplayStore((s) => s.defaultCardView);
  const setDefaultCardView = useDisplayStore((s) => s.setDefaultCardView);
  const overrides = useDisplayStore((s) => s.overrides);
  const resetPreference = useDisplayStore((s) => s.resetPreference);
  const themePreference = useThemeStore((s) => s.preference);
  const setTheme = useThemeStore((s) => s.setTheme);
  const palettePreference = usePaletteStore((s) => s.preference);
  const setPalette = usePaletteStore((s) => s.setPalette);

  return (
    <SettingsSection id="display" title={m.profile_display_title()}>
      <SettingsRow label={m.profile_display_theme()}>
        <ThemePicker value={themePreference} onChange={setTheme} />
        {themePreference !== null && (
          <ResetButton onClick={() => setTheme(null)} label={m.profile_display_theme_reset()} />
        )}
      </SettingsRow>

      <SettingsRow label={m.locale_switcher_label()}>
        <DisplayLocalePicker />
      </SettingsRow>

      {PALETTE_VALUES.length > 1 && (
        <SettingsRow label={m.profile_display_palette()}>
          <PalettePicker value={palettePreference} onChange={setPalette} />
          {palettePreference !== null && (
            <ResetButton
              onClick={() => setPalette(null)}
              label={m.profile_display_palette_reset()}
            />
          )}
        </SettingsRow>
      )}

      <SettingsRow label={m.profile_display_default_card_view()}>
        <DefaultCardViewPicker value={defaultCardView} onChange={setDefaultCardView} />
        {overrides.defaultCardView !== null && (
          <ResetButton
            onClick={() => resetPreference("defaultCardView")}
            label={m.profile_display_default_card_view_reset()}
          />
        )}
      </SettingsRow>

      <SettingsRow label={m.profile_display_show_images()} htmlFor="pref-images">
        <Switch
          id="pref-images"
          checked={showImages}
          onCheckedChange={(checked: boolean) => setShowImages(checked)}
        />
        {overrides.showImages !== null && (
          <ResetButton
            onClick={() => resetPreference("showImages")}
            label={m.profile_display_show_images_reset()}
          />
        )}
      </SettingsRow>

      <SettingsRow label={m.profile_display_fancy_fan()} htmlFor="pref-fan">
        <Switch
          id="pref-fan"
          checked={fancyFan}
          onCheckedChange={(checked: boolean) => setFancyFan(checked)}
        />
        {overrides.fancyFan !== null && (
          <ResetButton
            onClick={() => resetPreference("fancyFan")}
            label={m.profile_display_fancy_fan_reset()}
          />
        )}
      </SettingsRow>

      <SettingsRow label={m.profile_display_foil_effect()} htmlFor="pref-foil">
        <Switch
          id="pref-foil"
          checked={foilEffect}
          onCheckedChange={(checked: boolean) => setFoilEffect(checked)}
        />
        {overrides.foilEffect !== null && (
          <ResetButton
            onClick={() => resetPreference("foilEffect")}
            label={m.profile_display_foil_effect_reset()}
          />
        )}
      </SettingsRow>

      <SettingsRow label={m.profile_display_card_tilt()} htmlFor="pref-tilt">
        <Switch
          id="pref-tilt"
          checked={cardTilt}
          onCheckedChange={(checked: boolean) => setCardTilt(checked)}
        />
        {overrides.cardTilt !== null && (
          <ResetButton
            onClick={() => resetPreference("cardTilt")}
            label={m.profile_display_card_tilt_reset()}
          />
        )}
      </SettingsRow>

      <SettingsRow
        label={m.profile_display_frosted_bars()}
        htmlFor="pref-frosted"
        description={m.profile_display_frosted_bars_description()}
      >
        <Switch
          id="pref-frosted"
          checked={frostedBars}
          onCheckedChange={(checked: boolean) => setFrostedBars(checked)}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

const DISPLAY_LOCALE_OPTIONS: { value: DisplayLocale; label: string }[] = DISPLAY_LOCALES.map(
  (locale) => ({ value: locale, label: DISPLAY_LOCALE_LABELS[locale] }),
);

function DisplayLocalePicker() {
  const [pending, setPending] = useState(false);
  const active = getLocale();

  const change = async (next: DisplayLocale) => {
    if (next === active || pending) {
      return;
    }
    setPending(true);
    // Applying the locale reloads the document, so the account write has to
    // land first. On failure nothing changes and the old locale stays selected.
    try {
      await persistDisplayLocale(next);
    } catch {
      setPending(false);
      toast.error(m.profile_display_locale_error());
      return;
    }
    await setLocale(next);
  };

  return (
    <SegmentedRadio
      value={active}
      onValueChange={(next) => void change(next)}
      options={DISPLAY_LOCALE_OPTIONS}
    />
  );
}

function themeOptions(): { value: Theme; label: string }[] {
  return [
    { value: "auto", label: m.profile_display_theme_auto() },
    { value: "light", label: m.profile_display_theme_light() },
    { value: "dark", label: m.profile_display_theme_dark() },
  ];
}

function ThemePicker({
  value,
  onChange,
}: {
  value: Theme | null;
  onChange: (value: Theme | null) => void;
}) {
  return (
    <SegmentedRadio
      value={value ?? PREFERENCE_DEFAULTS.theme}
      onValueChange={(next) =>
        onChange(next === PREFERENCE_DEFAULTS.theme ? null : (next as Theme))
      }
      options={themeOptions()}
    />
  );
}

// Palette is hidden from the UI until a second option ships. Adding an entry
// here automatically reveals the picker in DisplaySection.
const PALETTE_VALUES: Palette[] = ["default", "minimal"];

const PALETTE_LABELS: Record<Palette, () => string> = {
  default: () => m.profile_display_palette_default(),
  minimal: () => m.profile_display_palette_minimal(),
};

function paletteOptions(): { value: Palette; label: string }[] {
  return PALETTE_VALUES.map((value) => ({ value, label: PALETTE_LABELS[value]() }));
}

function PalettePicker({
  value,
  onChange,
}: {
  value: Palette | null;
  onChange: (value: Palette | null) => void;
}) {
  return (
    <SegmentedRadio
      value={value ?? "default"}
      onValueChange={(next) => onChange(next === "default" ? null : (next as Palette))}
      options={paletteOptions()}
    />
  );
}

function defaultCardViewOptions(): { value: DefaultCardView; label: string }[] {
  return [
    { value: "cards", label: m.profile_display_card_view_cards() },
    { value: "printings", label: m.profile_display_card_view_printings() },
  ];
}

function DefaultCardViewPicker({
  value,
  onChange,
}: {
  value: DefaultCardView;
  onChange: (value: DefaultCardView) => void;
}) {
  return (
    <SegmentedRadio
      value={value}
      onValueChange={(next) => onChange(next as DefaultCardView)}
      options={defaultCardViewOptions()}
    />
  );
}

function SegmentedRadio<TValue extends string>({
  value,
  onValueChange,
  options,
}: {
  value: TValue;
  onValueChange: (value: TValue) => void;
  options: { value: TValue; label: string }[];
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onValueChange(next as TValue)}
      className="bg-muted inline-flex w-fit flex-row items-center gap-0.5 rounded-md p-0.5"
    >
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className={cn(
            "rounded-sm border border-transparent px-2.5 py-1 text-sm font-medium transition-colors outline-none",
            "data-checked:bg-background data-checked:text-foreground data-checked:shadow-sm",
            "dark:data-checked:bg-input/30 dark:data-checked:border-input",
            "data-unchecked:text-muted-foreground data-unchecked:hover:text-foreground",
          )}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
