import type { ReactElement, ReactNode } from "react";

import { SettingsRow } from "@/components/layout/settings-row";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { SCAN_ZOOMS } from "@/features/scan/lib/scan-zoom";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

interface LanguageItem {
  value: string;
  label: string;
}

export interface ScanSettingsProps {
  languageItems: LanguageItem[];
  language: string;
  onLanguageChange: (value: string) => void;
  muted: boolean;
  onMutedChange: (value: boolean) => void;
  tapToScan: boolean;
  onTapToScanChange: (value: boolean) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
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
  muted,
  onMutedChange,
  tapToScan,
  onTapToScanChange,
  zoom,
  onZoomChange,
  deviceTooSlow,
}: ScanSettingsMenuProps) {
  const zoomItems = SCAN_ZOOMS.map((step) => ({
    value: String(step),
    label: `${formatCount(step)}×`,
  }));
  return (
    <Popover>
      <PopoverTrigger render={trigger}>{triggerContent}</PopoverTrigger>
      <PopoverContent align="end" className="w-88 max-w-[calc(100vw-1.5rem)] gap-4 p-4">
        <SettingsRow
          label={m.scan_settings_language_label()}
          description={m.scan_settings_language_description()}
        >
          <SimpleSelect
            items={languageItems}
            value={language}
            onChange={onLanguageChange}
            label={m.scan_settings_language_label()}
            className="w-36"
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

        <SettingsRow
          label={m.scan_settings_zoom_label()}
          description={m.scan_settings_zoom_description()}
        >
          <SimpleSelect
            items={zoomItems}
            value={String(zoom)}
            onChange={(value) => onZoomChange(Number(value))}
            label={m.scan_settings_zoom_label()}
            className="w-36"
          />
        </SettingsRow>
      </PopoverContent>
    </Popover>
  );
}
