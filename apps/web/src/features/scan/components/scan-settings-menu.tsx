import type { ReactElement, ReactNode } from "react";

import { SettingsRow } from "@/components/layout/settings-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { m } from "@/paraglide/messages.js";

interface LanguageItem {
  value: string;
  label: string;
}

export interface ScanSettingsProps {
  languageItems: LanguageItem[];
  language: string;
  onLanguageChange: (value: string) => void;
  autoScan: boolean;
  onAutoScanChange: (value: boolean) => void;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  tapToScan: boolean;
  onTapToScanChange: (value: boolean) => void;
  deviceTooSlow: boolean;
}

interface ScanSettingsMenuProps extends ScanSettingsProps {
  trigger: ReactElement;
  triggerContent?: ReactNode;
}

export function ScanSettingsMenu({
  trigger,
  triggerContent,
  languageItems,
  language,
  onLanguageChange,
  autoScan,
  onAutoScanChange,
  muted,
  onMutedChange,
  tapToScan,
  onTapToScanChange,
  deviceTooSlow,
}: ScanSettingsMenuProps) {
  return (
    <Popover>
      <PopoverTrigger render={trigger}>{triggerContent}</PopoverTrigger>
      <PopoverContent align="end" className="w-88 max-w-[calc(100vw-1.5rem)] gap-4 p-4">
        <SettingsRow
          label={m.scan_settings_language_label()}
          description={m.scan_settings_language_description()}
        >
          <Select
            items={languageItems}
            value={language}
            onValueChange={(value) => {
              if (value) {
                onLanguageChange(value);
              }
            }}
          >
            <SelectTrigger aria-label={m.scan_settings_language_label()} className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languageItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label={m.scan_settings_count_every_copy_label()}
          description={m.scan_settings_count_every_copy_description()}
        >
          <Switch
            aria-label={m.scan_settings_count_every_copy_label()}
            checked={autoScan}
            onCheckedChange={onAutoScanChange}
          />
        </SettingsRow>

        <SettingsRow
          label={m.scan_settings_sounds_label()}
          description={m.scan_settings_sounds_description()}
        >
          <Switch
            aria-label={m.scan_settings_sounds_label()}
            checked={!muted}
            onCheckedChange={(checked: boolean) => onMutedChange(!checked)}
          />
        </SettingsRow>

        <SettingsRow
          label={m.scan_settings_tap_label()}
          description={m.scan_settings_tap_description()}
        >
          <Switch
            aria-label={m.scan_settings_tap_label()}
            checked={deviceTooSlow || tapToScan}
            disabled={deviceTooSlow}
            onCheckedChange={onTapToScanChange}
          />
        </SettingsRow>
      </PopoverContent>
    </Popover>
  );
}
