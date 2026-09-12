import { formatDay } from "@openrift/shared/format-date";
import type { DeckCheckKeyResponse } from "@openrift/shared/types/api/deck-check";
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  useMintMyDeckCheckKey,
  useMintOrgDeckCheckKey,
  useMyDeckCheckKeys,
  useOrgDeckCheckKeys,
  useRemoveMyDeckCheckKey,
  useRemoveOrgDeckCheckKey,
  useRenameMyDeckCheckKey,
  useRenameOrgDeckCheckKey,
  useRevokeMyDeckCheckKey,
  useRevokeOrgDeckCheckKey,
} from "@/features/tournaments/hooks/use-deck-check-keys";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { m } from "@/paraglide/messages.js";

interface KeyActions {
  keys: DeckCheckKeyResponse[] | undefined;
  mint: (label: string) => Promise<string>;
  mintPending: boolean;
  rename: (keyId: string, label: string) => Promise<void>;
  revoke: (keyId: string) => Promise<void>;
  revokePending: boolean;
  remove: (keyId: string) => Promise<void>;
  removePending: boolean;
}

export function MyDeckCheckKeysSection({ enabled = true }: { enabled?: boolean }) {
  const { data } = useMyDeckCheckKeys(enabled);
  const mintKey = useMintMyDeckCheckKey();
  const renameKey = useRenameMyDeckCheckKey();
  const revokeKey = useRevokeMyDeckCheckKey();
  const removeKey = useRemoveMyDeckCheckKey();
  return (
    <DeckCheckKeysCard
      keys={data?.items}
      mint={async (label) => {
        const result = await mintKey.mutateAsync({ label });
        return result.token;
      }}
      mintPending={mintKey.isPending}
      rename={async (keyId, label) => {
        await renameKey.mutateAsync({ keyId, label });
      }}
      revoke={async (keyId) => {
        await revokeKey.mutateAsync({ keyId });
      }}
      revokePending={revokeKey.isPending}
      remove={async (keyId) => {
        await removeKey.mutateAsync({ keyId });
      }}
      removePending={removeKey.isPending}
    />
  );
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
      mint={async (label) => {
        const result = await mintKey.mutateAsync({ orgId, label });
        return result.token;
      }}
      mintPending={mintKey.isPending}
      rename={async (keyId, label) => {
        await renameKey.mutateAsync({ orgId, keyId, label });
      }}
      revoke={async (keyId) => {
        await revokeKey.mutateAsync({ orgId, keyId });
      }}
      revokePending={revokeKey.isPending}
      remove={async (keyId) => {
        await removeKey.mutateAsync({ orgId, keyId });
      }}
      removePending={removeKey.isPending}
    />
  );
}

function DeckCheckKeysCard(actions: KeyActions) {
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
            <KeyRow key={key.id} apiKey={key} actions={actions} />
          ))}
        </RowList>
      ) : (
        <p className="text-muted-foreground text-sm">{m.profile_deck_check_empty()}</p>
      )}

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onMint={(label) => actions.mint(label)}
        mintPending={actions.mintPending}
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
  mintPending,
  onMinted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMint: (label: string) => Promise<string>;
  mintPending: boolean;
  onMinted: (token: string) => void;
}) {
  const [label, setLabel] = useState("");

  const handleCreate = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      return;
    }
    const token = await onMint(trimmed);
    setLabel("");
    onOpenChange(false);
    onMinted(token);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setLabel("");
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.profile_deck_check_cancel()}
            </Button>
            <Button type="submit" disabled={mintPending || !label.trim()}>
              {mintPending ? m.profile_deck_check_creating() : m.profile_deck_check_create()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function KeyRow({ apiKey, actions }: { apiKey: DeckCheckKeyResponse; actions: KeyActions }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const revoked = apiKey.revokedAt !== null;

  async function handleRevoke() {
    try {
      await actions.revoke(apiKey.id);
      setConfirmOpen(false);
      toast.success(m.profile_deck_check_toast_revoked());
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  async function handleRemove() {
    try {
      await actions.remove(apiKey.id);
      setRemoveOpen(false);
      toast.success(m.profile_deck_check_toast_removed());
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <RowListItem className="gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {apiKey.label ?? m.profile_deck_check_unnamed()}{" "}
          <code className="text-muted-foreground font-normal">{apiKey.tokenPrefix}…</code>
        </span>
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
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => setRemoveOpen(true)}
          >
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
      />
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={m.profile_deck_check_revoke_confirm_title()}
        description={m.profile_deck_check_revoke_confirm_description()}
        confirmLabel={m.profile_deck_check_revoke()}
        pendingLabel={m.profile_deck_check_revoking()}
        isPending={actions.revokePending}
        onConfirm={() => void handleRevoke()}
      />
      <ConfirmActionDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={m.profile_deck_check_remove_confirm_title()}
        description={m.profile_deck_check_remove_confirm_description()}
        confirmLabel={m.profile_deck_check_remove()}
        pendingLabel={m.profile_deck_check_removing()}
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
}: {
  apiKey: DeckCheckKeyResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (keyId: string, label: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(apiKey.label ?? "");
  const [pending, setPending] = useState(false);

  const handleRename = async () => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === apiKey.label) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    try {
      await onRename(apiKey.id, trimmed);
      onOpenChange(false);
    } catch (error) {
      setPending(false);
      throw error;
    }
    setPending(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setLabel(apiKey.label ?? "");
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
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.profile_deck_check_cancel()}
            </Button>
            <Button type="submit" disabled={pending || !label.trim()}>
              {pending ? m.profile_deck_check_saving() : m.profile_deck_check_save()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

function MintedKeyDialog({ token, onClose }: { token: string | null; onClose: () => void }) {
  const { copied, copy, reset } = useCopyToClipboard();

  return (
    <Dialog
      open={token !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogForm
          onSubmit={() => {
            if (token) {
              void copy(token);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{m.profile_deck_check_minted_title()}</DialogTitle>
            <DialogDescription>{m.profile_deck_check_minted_description()}</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-md p-3 font-mono text-sm break-all">{token}</div>
          <DialogFooter>
            <Button type="submit">
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? m.profile_deck_check_copied() : m.profile_deck_check_copy()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
