import { formatDay } from "@openrift/shared/format-date";
import type { DeckCheckKeyResponse } from "@openrift/shared/types/api/deck-check";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { CopyField } from "@/components/ui/copy-field";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  useMintOrgDeckCheckKey,
  useOrgDeckCheckKeys,
  useRemoveOrgDeckCheckKey,
  useRenameOrgDeckCheckKey,
  useRevokeOrgDeckCheckKey,
} from "@/features/tournaments/hooks/use-deck-check-keys";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

interface MutationState {
  isPending: boolean;
  error: unknown;
  reset: () => void;
}

export interface DeckCheckKeyActions {
  keys: DeckCheckKeyResponse[] | undefined;
  mint: (label: string) => Promise<{ token: string }>;
  mintState: MutationState;
  rename: (keyId: string, label: string) => Promise<unknown>;
  renameState: MutationState;
  revoke: (keyId: string) => Promise<unknown>;
  revokePending: boolean;
  remove: (keyId: string) => Promise<unknown>;
  removePending: boolean;
}

export function OrgDeckCheckKeysSection({
  orgId,
  enabled = true,
}: {
  orgId: string;
  enabled?: boolean;
}) {
  const { data } = useOrgDeckCheckKeys(orgId, enabled);
  const mintKey = useMintOrgDeckCheckKey();
  const renameKey = useRenameOrgDeckCheckKey();
  const revokeKey = useRevokeOrgDeckCheckKey();
  const removeKey = useRemoveOrgDeckCheckKey();
  return (
    <DeckCheckKeysCard
      keys={data?.items}
      mint={(label) => mintKey.mutateAsync({ orgId, label })}
      mintState={mintKey}
      rename={(keyId, label) => renameKey.mutateAsync({ orgId, keyId, label })}
      renameState={renameKey}
      revoke={(keyId) => revokeKey.mutateAsync({ orgId, keyId })}
      revokePending={revokeKey.isPending}
      remove={(keyId) => removeKey.mutateAsync({ orgId, keyId })}
      removePending={removeKey.isPending}
    />
  );
}

function DeckCheckKeysCard(actions: DeckCheckKeyActions) {
  const { keys } = actions;
  const [createOpen, setCreateOpen] = useState(false);
  const [mintedToken, setMintedToken] = useState<string | null>(null);

  return (
    <SettingsSection
      title={m.profile_deck_check_title()}
      description={m.profile_deck_check_description()}
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          {m.profile_deck_check_create_key()}
        </Button>
      }
    >
      {keys && keys.length > 0 ? (
        <RowList>
          {keys.map((key) => (
            <DeckCheckKeyRow key={key.id} apiKey={key} actions={actions} />
          ))}
        </RowList>
      ) : (
        <Empty className="p-4">
          <EmptyDescription>{m.profile_deck_check_empty()}</EmptyDescription>
        </Empty>
      )}

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onMint={(label) => actions.mint(label)}
        mintState={actions.mintState}
        onMinted={setMintedToken}
      />
      <MintedKeyDialog token={mintedToken} onClose={() => setMintedToken(null)} />
    </SettingsSection>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onMint,
  mintState,
  onMinted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMint: (label: string) => Promise<{ token: string }>;
  mintState: MutationState;
  onMinted: (token: string) => void;
}) {
  const [label, setLabel] = useState("");

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }
    let token: string | undefined;
    const ok = await runReportedMutation(async () => {
      const minted = await onMint(trimmed);
      token = minted.token;
    });
    if (ok && token !== undefined) {
      setLabel("");
      onOpenChange(false);
      onMinted(token);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setLabel("");
        } else {
          mintState.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleCreate()}>
          <DialogHeader>
            <DialogTitle>{m.profile_deck_check_create_title()}</DialogTitle>
            <DialogDescription>{m.profile_deck_check_create_description()}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deck-check-key-label">{m.profile_deck_check_name_label()}</Label>
            <Input
              id="deck-check-key-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={m.profile_deck_check_name_placeholder()}
              maxLength={120}
            />
          </div>
          <SaveError error={mintState.error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={!label.trim()} pending={mintState.isPending}>
              {m.profile_deck_check_create()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function DeckCheckKeyRow({
  apiKey,
  actions,
  kindLabel,
}: {
  apiKey: DeckCheckKeyResponse;
  actions: Pick<
    DeckCheckKeyActions,
    "rename" | "renameState" | "revoke" | "revokePending" | "remove" | "removePending"
  >;
  kindLabel?: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const revoked = apiKey.revokedAt !== null;

  async function handleRevoke() {
    if (await runReportedMutation(() => actions.revoke(apiKey.id))) {
      setConfirmOpen(false);
      toast.success(m.profile_deck_check_toast_revoked());
    }
  }

  async function handleRemove() {
    if (await runReportedMutation(() => actions.remove(apiKey.id))) {
      setRemoveOpen(false);
      toast.success(m.profile_deck_check_toast_removed());
    }
  }

  return (
    <RowListItem className="gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {apiKey.label ?? m.profile_deck_check_unnamed()}{" "}
          <Code className="text-muted-foreground font-normal">{apiKey.tokenPrefix}…</Code>
        </span>
        {kindLabel && <span className="text-muted-foreground text-sm">{kindLabel}</span>}
        <span className="text-muted-foreground text-sm">
          {apiKey.createdByName
            ? m.profile_deck_check_created_by({
                date: formatDay(apiKey.createdAt),
                name: apiKey.createdByName,
              })
            : m.profile_deck_check_created({ date: formatDay(apiKey.createdAt) })}
          {" · "}
          {apiKey.lastUsedAt
            ? m.profile_deck_check_last_used({ date: formatDay(apiKey.lastUsedAt) })
            : m.profile_deck_check_never_used()}
        </span>
      </div>
      {revoked ? (
        <>
          <Badge variant="secondary">{m.profile_deck_check_revoked_badge()}</Badge>
          <Button size="sm" variant="ghost-destructive" onClick={() => setRemoveOpen(true)}>
            {m.profile_deck_check_remove()}
          </Button>
        </>
      ) : (
        <>
          <Button
            size="sm"
            variant="ghost"
            aria-label={m.profile_deck_check_rename_aria()}
            onClick={() => setRenameOpen(true)}
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
            {m.profile_deck_check_revoke()}
          </Button>
        </>
      )}
      <RenameKeyDialog
        apiKey={apiKey}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onRename={(keyId, label) => actions.rename(keyId, label)}
        renameState={actions.renameState}
      />
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={m.profile_deck_check_revoke_confirm_title()}
        description={m.profile_deck_check_revoke_confirm_description()}
        confirmLabel={m.profile_deck_check_revoke()}
        isPending={actions.revokePending}
        onConfirm={() => void handleRevoke()}
      />
      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={m.profile_deck_check_remove_confirm_title()}
        description={m.profile_deck_check_remove_confirm_description()}
        confirmLabel={m.profile_deck_check_remove()}
        isPending={actions.removePending}
        onConfirm={() => void handleRemove()}
      />
    </RowListItem>
  );
}

function RenameKeyDialog({
  apiKey,
  open,
  onOpenChange,
  onRename,
  renameState,
}: {
  apiKey: DeckCheckKeyResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (keyId: string, label: string) => Promise<unknown>;
  renameState: MutationState;
}) {
  const [label, setLabel] = useState(apiKey.label ?? "");

  const handleRename = async () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === apiKey.label) {
      renameState.reset();
      onOpenChange(false);
      return;
    }
    if (await runReportedMutation(() => onRename(apiKey.id, trimmed))) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setLabel(apiKey.label ?? "");
        } else {
          renameState.reset();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleRename()}>
          <DialogHeader>
            <DialogTitle>{m.profile_deck_check_rename_title()}</DialogTitle>
          </DialogHeader>
          <Input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} />
          <SaveError error={renameState.error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={!label.trim()} pending={renameState.isPending}>
              {m.common_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function MintedKeyDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.profile_deck_check_minted_title()}</DialogTitle>
          <DialogDescription>{m.profile_deck_check_minted_description()}</DialogDescription>
        </DialogHeader>
        <CopyField value={token ?? ""} aria-label={m.profile_deck_check_token_label()} mono />
      </DialogContent>
    </Dialog>
  );
}
