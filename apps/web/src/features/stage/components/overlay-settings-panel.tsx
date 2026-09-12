import type {
  OverlayChannelResponse,
  OverlayCorner,
  OverlayPlateFields,
  OverlayPlatePosition,
} from "@openrift/shared/contracts/overlay";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { SettingsRow } from "@/components/layout/settings-row";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import { OverlayPresetsSection } from "@/features/stage/components/overlay-presets-section";
import {
  useDisableOverlayToken,
  useEnableOverlayToken,
  useUpdateOverlaySettings,
} from "@/features/stage/hooks/use-overlay";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

const CORNER_VALUES: OverlayCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

function corners(): { value: OverlayCorner; label: string }[] {
  return [
    { value: "top-left", label: m.stage_corner_top_left() },
    { value: "top-right", label: m.stage_corner_top_right() },
    { value: "bottom-left", label: m.stage_corner_bottom_left() },
    { value: "bottom-right", label: m.stage_corner_bottom_right() },
  ];
}

function isCorner(value: unknown): value is OverlayCorner {
  return CORNER_VALUES.some((corner) => corner === value);
}

const PLATE_POSITION_VALUES: OverlayPlatePosition[] = ["auto", "left", "right", "above", "below"];

function platePositions(): { value: OverlayPlatePosition; label: string }[] {
  return [
    { value: "auto", label: m.stage_plate_position_auto() },
    { value: "left", label: m.stage_plate_position_left() },
    { value: "right", label: m.stage_plate_position_right() },
    { value: "above", label: m.stage_plate_position_above() },
    { value: "below", label: m.stage_plate_position_below() },
  ];
}

function isPlatePosition(value: unknown): value is OverlayPlatePosition {
  return PLATE_POSITION_VALUES.some((position) => position === value);
}

function plateFields(): { key: keyof OverlayPlateFields; label: string }[] {
  return [
    { key: "name", label: m.stage_plate_field_name() },
    { key: "code", label: m.stage_plate_field_code() },
    { key: "stats", label: m.stage_plate_field_stats() },
    { key: "rulesText", label: m.stage_plate_field_rules_text() },
    { key: "flavorText", label: m.stage_plate_field_flavor_text() },
  ];
}

export function OverlaySettingsPanel({
  channel,
  draftScale,
  onDraftScaleChange,
}: {
  channel: OverlayChannelResponse;
  draftScale: number | null;
  onDraftScaleChange: (scale: number | null) => void;
}) {
  const updateSettings = useUpdateOverlaySettings();
  const enableToken = useEnableOverlayToken();
  const disableToken = useDisableOverlayToken();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const { payload } = channel;

  // Written only on release, not on drag: each write bumps the version the browser source polls for.
  const shownScale = draftScale ?? payload.scale;

  const sourceUrl = channel.token ? `${getSiteUrl()}/stage/source/${channel.token}` : null;

  return (
    <div className="flex flex-col gap-8">
      <SettingsSection
        title={m.stage_browser_source_title()}
        description={m.stage_browser_source_description()}
      >
        {sourceUrl ? (
          <ShareLinkRow
            url={sourceUrl}
            label={m.stage_browser_source_url_label()}
            hideQr
            actions={
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDisable(true)}
                disabled={disableToken.isPending}
              >
                {m.stage_browser_source_disable()}
              </Button>
            }
          />
        ) : (
          <Button
            className="w-fit"
            onClick={() => enableToken.mutate()}
            disabled={enableToken.isPending}
          >
            {m.stage_browser_source_enable()}
          </Button>
        )}
      </SettingsSection>

      <ConfirmActionDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title={m.stage_browser_source_disable_title()}
        description={m.stage_browser_source_disable_description()}
        confirmLabel={m.stage_browser_source_disable_confirm()}
        pendingLabel={m.stage_browser_source_disable_pending()}
        isPending={disableToken.isPending}
        onConfirm={() => {
          disableToken.mutate();
          setConfirmDisable(false);
        }}
      />

      <SettingsSection title={m.stage_placement_title()}>
        <div className="flex flex-col gap-2">
          <Label>{m.stage_corner_label()}</Label>
          <ToggleGroup
            aria-label={m.stage_corner_label()}
            variant="outline"
            value={[payload.corner]}
            onValueChange={([next]) => {
              if (isCorner(next)) {
                updateSettings.mutate({ corner: next });
              }
            }}
            className="grid w-full grid-cols-2"
          >
            {corners().map((corner) => (
              <ToggleGroupItem key={corner.value} value={corner.value}>
                {corner.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{m.stage_overlay_card_size_label({ scale: shownScale })}</Label>
          <Slider
            aria-label={m.stage_card_size()}
            min={20}
            max={100}
            step={5}
            value={[shownScale]}
            onValueChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              if (typeof next === "number") {
                onDraftScaleChange(next);
              }
            }}
            onValueCommitted={(value) => {
              const next = Array.isArray(value) ? value[0] : value;
              onDraftScaleChange(null);
              if (typeof next === "number" && next !== payload.scale) {
                updateSettings.mutate({ scale: next });
              }
            }}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={m.stage_plate_title()}
        action={
          <Switch
            id="overlay-plate"
            aria-label={m.stage_plate_title()}
            checked={payload.showPlate}
            onCheckedChange={(checked) => updateSettings.mutate({ showPlate: checked })}
          />
        }
      >
        {payload.showPlate && (
          <>
            <div className="flex flex-col gap-2">
              <Label>{m.stage_plate_position_label()}</Label>
              <ToggleGroup
                aria-label={m.stage_plate_position_aria()}
                variant="outline"
                value={[payload.platePosition]}
                onValueChange={([next]) => {
                  if (isPlatePosition(next)) {
                    updateSettings.mutate({ platePosition: next });
                  }
                }}
                className="grid w-full grid-cols-5"
              >
                {platePositions().map((position) => (
                  <ToggleGroupItem key={position.value} value={position.value}>
                    {position.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-muted-foreground text-sm">{m.stage_plate_position_auto_hint()}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>{m.stage_plate_fields_label()}</Label>
              {plateFields().map((field) => (
                <SettingsRow
                  key={field.key}
                  label={field.label}
                  htmlFor={`overlay-plate-${field.key}`}
                >
                  <Switch
                    id={`overlay-plate-${field.key}`}
                    checked={payload.plateFields[field.key]}
                    onCheckedChange={(checked) =>
                      updateSettings.mutate({ plateFields: { [field.key]: checked } })
                    }
                  />
                </SettingsRow>
              ))}
            </div>
          </>
        )}
      </SettingsSection>

      <SettingsSection title={m.stage_qr_title()}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="overlay-qr-url">{m.stage_qr_url_label()}</Label>
          <Input
            id="overlay-qr-url"
            type="url"
            defaultValue={payload.qrUrl ?? ""}
            placeholder="https://openrift.app/decks/share/…"
            onBlur={(event) => {
              const next = event.target.value.trim();
              const current = payload.qrUrl ?? "";
              if (next !== current) {
                updateSettings.mutate({ qrUrl: next === "" ? null : next });
              }
            }}
          />
          <p className="text-muted-foreground text-sm">{m.stage_qr_url_hint()}</p>
        </div>
      </SettingsSection>

      <OverlayPresetsSection channel={channel} />
    </div>
  );
}
