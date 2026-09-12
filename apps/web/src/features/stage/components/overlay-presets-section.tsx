import type { OverlayChannelResponse } from "@openrift/shared/contracts/overlay";
import type { StagePreset } from "@openrift/shared/contracts/stage-presets";
import {
  BookmarkPlusIcon,
  EllipsisVerticalIcon,
  LinkIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { StagePresetNameDialog } from "@/features/stage/components/stage-preset-name-dialog";
import { useUpdateOverlaySettings } from "@/features/stage/hooks/use-overlay";
import {
  useCreateStagePreset,
  useDeleteStagePreset,
  useStagePresets,
  useUpdateStagePreset,
} from "@/features/stage/hooks/use-stage-presets";
import {
  captureOverlayPreset,
  presetToOverlaySettings,
} from "@/features/stage/lib/stage-preset-apply";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

/** URL pinned to one preset; a source added with it ignores the live dashboard settings. */
function presetSourceUrl(token: string, presetId: string): string {
  return `${getSiteUrl()}/stage/source/${token}?preset=${presetId}`;
}

export function OverlayPresetsSection({ channel }: { channel: OverlayChannelResponse }) {
  const { data: presets } = useStagePresets();
  const createPreset = useCreateStagePreset();
  const updateSettings = useUpdateOverlaySettings();
  const [saveOpen, setSaveOpen] = useState(false);

  const save = (name: string) => {
    createPreset.mutate(
      { name, config: captureOverlayPreset(channel.payload) },
      {
        onSuccess: () => setSaveOpen(false),
      },
    );
  };

  const items = presets ?? [];

  return (
    <SettingsSection
      title={m.stage_presets_title()}
      description={m.stage_presets_description()}
      action={
        <Button variant="outline" onClick={() => setSaveOpen(true)}>
          <BookmarkPlusIcon />
          {m.stage_presets_save_current()}
        </Button>
      }
    >
      {channel.token ? null : (
        <p className="text-muted-foreground text-sm">{m.stage_presets_need_source_link()}</p>
      )}

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.stage_presets_empty()}</p>
      ) : (
        <RowList>
          {items.map((preset) => (
            <OverlayPresetRow
              key={preset.id}
              preset={preset}
              token={channel.token}
              applying={updateSettings.isPending}
              onApply={() => updateSettings.mutate(presetToOverlaySettings(preset.config))}
            />
          ))}
        </RowList>
      )}

      <StagePresetNameDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title={m.stage_presets_save_title()}
        description={m.stage_presets_save_description()}
        confirmLabel={m.common_save()}
        pending={createPreset.isPending}
        onConfirm={save}
      />
    </SettingsSection>
  );
}

function OverlayPresetRow({
  preset,
  token,
  applying,
  onApply,
}: {
  preset: StagePreset;
  token: string | null;
  applying: boolean;
  onApply: () => void;
}) {
  const updatePreset = useUpdateStagePreset();
  const deletePreset = useDeleteStagePreset();
  const { copy } = useCopyToClipboard();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const copyLink = async () => {
    if (!token) {
      return;
    }
    const ok = await copy(presetSourceUrl(token, preset.id));
    if (ok) {
      toast.success(m.stage_preset_copy_success());
      return;
    }
    toast.error(m.stage_preset_copy_error());
  };

  const rename = (name: string) => {
    updatePreset.mutate({ id: preset.id, name }, { onSuccess: () => setRenameOpen(false) });
  };

  return (
    <RowListItem className="gap-1">
      <Button
        variant="ghost"
        className="-ml-2 flex-1 justify-start"
        disabled={applying}
        onClick={onApply}
      >
        {preset.name}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={m.stage_preset_options_aria({ name: preset.name })}
            />
          }
        >
          <EllipsisVerticalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!token} onClick={() => void copyLink()}>
            <LinkIcon />
            {m.stage_preset_copy_source_url()}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <PencilIcon />
            {m.stage_preset_rename()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon />
            {m.common_delete()}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StagePresetNameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={m.stage_preset_rename_title()}
        description={m.stage_preset_rename_description()}
        confirmLabel={m.stage_preset_rename()}
        initialName={preset.name}
        pending={updatePreset.isPending}
        onConfirm={rename}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{m.stage_preset_delete_title()}</AlertDialogTitle>
            <AlertDialogDescription>
              {m.stage_preset_delete_description({ name: preset.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{m.stage_preset_delete_keep()}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePreset.mutate(preset.id)}
              disabled={deletePreset.isPending}
            >
              {m.common_delete()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowListItem>
  );
}
