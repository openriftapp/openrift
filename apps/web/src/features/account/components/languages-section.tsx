import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

  const enabledSet = new Set(languages);
  const availableByCode = new Map(availableLanguages.map((lang) => [lang.code, lang]));

  function toggleLanguage(code: string) {
    if (enabledSet.has(code)) {
      setLanguages(languages.filter((c) => c !== code));
    } else {
      setLanguages([...languages, code]);
    }
  }

  function moveLanguage(code: string, direction: -1 | 1) {
    const index = languages.indexOf(code);
    if (index === -1) {
      return;
    }
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= languages.length) {
      return;
    }
    const next = [...languages];
    next.splice(index, 1);
    next.splice(newIndex, 0, code);
    setLanguages(next);
  }

  const orderedCodes = [
    ...languages,
    ...availableLanguages.filter((lang) => !enabledSet.has(lang.code)).map((lang) => lang.code),
  ];

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
      <div className="flex flex-col gap-1">
        {orderedCodes.map((code) => {
          const lang = availableByCode.get(code);
          if (!lang) {
            return null;
          }
          const enabled = enabledSet.has(code);
          const index = languages.indexOf(code);
          return (
            <div key={code} className="flex min-h-8 items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id={`pref-lang-${code}`}
                  checked={enabled}
                  onCheckedChange={() => toggleLanguage(code)}
                />
                <Label htmlFor={`pref-lang-${code}`} className="font-normal">
                  {lang.name}
                </Label>
                <span className="text-muted-foreground text-xs">{code}</span>
                {enabled && index === 0 && (
                  <Badge variant="subtle">{m.profile_languages_preferred()}</Badge>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!enabled || index === 0}
                  onClick={() => moveLanguage(code, -1)}
                  aria-label={m.profile_languages_move_up({ name: lang.name })}
                >
                  <ArrowUpIcon className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!enabled || index === languages.length - 1}
                  onClick={() => moveLanguage(code, 1)}
                  aria-label={m.profile_languages_move_down({ name: lang.name })}
                >
                  <ArrowDownIcon className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
