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

const CORNERS: { value: OverlayCorner; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

function isCorner(value: unknown): value is OverlayCorner {
  return CORNERS.some((corner) => corner.value === value);
}

const PLATE_POSITIONS: { value: OverlayPlatePosition; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
];

function isPlatePosition(value: unknown): value is OverlayPlatePosition {
  return PLATE_POSITIONS.some((position) => position.value === value);
}

const PLATE_FIELDS: { key: keyof OverlayPlateFields; label: string }[] = [
  { key: "name", label: "Card name" },
  { key: "code", label: "Set code and foil" },
  { key: "stats", label: "Energy, power and might" },
  { key: "rulesText", label: "Rules text" },
  { key: "flavorText", label: "Flavor text" },
];

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
        title="Browser source"
        description="Add a Browser source in OBS and paste this URL. Anyone with the link sees what you push."
      >
        {sourceUrl ? (
          <ShareLinkRow
            url={sourceUrl}
            label="OBS browser source URL"
            hideQr
            actions={
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmDisable(true)}
                disabled={disableToken.isPending}
              >
                Disable
              </Button>
            }
          />
        ) : (
          <Button
            className="w-fit"
            onClick={() => enableToken.mutate()}
            disabled={enableToken.isPending}
          >
            Enable browser source link
          </Button>
        )}
      </SettingsSection>

      <ConfirmActionDialog
        open={confirmDisable}
        onOpenChange={setConfirmDisable}
        title="Disable the browser source link?"
        description="Every source pointed at it goes blank, including preset links. Enabling it again creates a different link."
        confirmLabel="Disable link"
        pendingLabel="Disabling…"
        isPending={disableToken.isPending}
        onConfirm={() => {
          disableToken.mutate();
          setConfirmDisable(false);
        }}
      />

      <SettingsSection title="Placement">
        <div className="flex flex-col gap-2">
          <Label>Corner</Label>
          <ToggleGroup
            aria-label="Corner"
            variant="outline"
            value={[payload.corner]}
            onValueChange={([next]) => {
              if (isCorner(next)) {
                updateSettings.mutate({ corner: next });
              }
            }}
            className="grid w-full grid-cols-2"
          >
            {CORNERS.map((corner) => (
              <ToggleGroupItem key={corner.value} value={corner.value}>
                {corner.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Card size — {shownScale}% of the canvas height</Label>
          <Slider
            aria-label="Card size"
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
        title="Card plate"
        action={
          <Switch
            id="overlay-plate"
            aria-label="Card plate"
            checked={payload.showPlate}
            onCheckedChange={(checked) => updateSettings.mutate({ showPlate: checked })}
          />
        }
      >
        {payload.showPlate && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Where it sits</Label>
              <ToggleGroup
                aria-label="Plate position"
                variant="outline"
                value={[payload.platePosition]}
                onValueChange={([next]) => {
                  if (isPlatePosition(next)) {
                    updateSettings.mutate({ platePosition: next });
                  }
                }}
                className="grid w-full grid-cols-5"
              >
                {PLATE_POSITIONS.map((position) => (
                  <ToggleGroupItem key={position.value} value={position.value}>
                    {position.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-muted-foreground text-sm">
                Auto keeps the plate on the card&apos;s inward side, so it follows the corner.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label>What it shows</Label>
              {PLATE_FIELDS.map((field) => (
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

      <SettingsSection title="QR code">
        <div className="flex flex-col gap-2">
          <Label htmlFor="overlay-qr-url">Link to put on screen</Label>
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
          <p className="text-muted-foreground text-sm">Any link. Leave empty to hide the code.</p>
        </div>
      </SettingsSection>

      <OverlayPresetsSection channel={channel} />
    </div>
  );
}
