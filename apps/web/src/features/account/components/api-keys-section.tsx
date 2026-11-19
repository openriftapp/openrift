import type { ApiKeyArea, ApiKeyAreaGrant } from "@openrift/shared/api-key-scopes";
import { API_KEY_AREAS } from "@openrift/shared/api-key-scopes";
import { formatDay } from "@openrift/shared/format-date";
import type { ApiKeyResponse } from "@openrift/shared/types/api/api-key";
import type { DeckCheckKeyResponse } from "@openrift/shared/types/api/deck-check";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
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
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from "@/features/account/hooks/use-api-keys";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  DeckCheckKeyRow,
  MintedKeyDialog,
} from "@/features/tournaments/components/deck-check-keys-section";
import { SaveError } from "@/features/tournaments/components/save-error";
import {
  useMintMyDeckCheckKey,
  useMyDeckCheckKeys,
  useRemoveMyDeckCheckKey,
  useRenameMyDeckCheckKey,
  useRevokeMyDeckCheckKey,
} from "@/features/tournaments/hooks/use-deck-check-keys";
import { formatList } from "@/lib/format-list";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { m } from "@/paraglide/messages.js";

type KeyKind = "account" | "decklist";
type ExpiryChoice = "30" | "90" | "365" | "never";

const NO_GRANTS: Record<ApiKeyArea, ApiKeyAreaGrant> = {
  collection: "none",
  lists: "none",
  decks: "none",
};

function areaLabel(area: ApiKeyArea): string {
  if (area === "collection") {
    return m.profile_api_keys_area_collection();
  }
  return area === "lists" ? m.profile_api_keys_area_lists() : m.profile_api_keys_area_decks();
}

function grantLabel(grant: ApiKeyAreaGrant): string {
  if (grant === "none") {
    return m.profile_api_keys_access_none();
  }
  return grant === "read" ? m.profile_api_keys_access_read() : m.profile_api_keys_access_write();
}

function scopeSummary(apiKey: ApiKeyResponse): string {
  const entries = API_KEY_AREAS.filter((area) => apiKey.grants[area] !== "none").map((area) =>
    m.profile_api_keys_scope_entry({
      area: areaLabel(area),
      access: grantLabel(apiKey.grants[area]),
    }),
  );
  if (apiKey.admin) {
    entries.push(m.profile_api_keys_admin_label());
  }
  return formatList(entries);
}

type Row =
  | { kind: "account"; createdAt: string; key: ApiKeyResponse }
  | { kind: "decklist"; createdAt: string; key: DeckCheckKeyResponse };

export function ApiKeysSection() {
  const { data: accountKeys } = useApiKeys();
  const { data: decklistKeys } = useMyDeckCheckKeys(true);
  const renameDecklistKey = useRenameMyDeckCheckKey();
  const revokeDecklistKey = useRevokeMyDeckCheckKey();
  const removeDecklistKey = useRemoveMyDeckCheckKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [mintedToken, setMintedToken] = useState<string | null>(null);

  const rows: Row[] = [
    ...(accountKeys ?? []).map((key) => ({
      kind: "account" as const,
      createdAt: key.createdAt,
      key,
    })),
    ...(decklistKeys?.items ?? []).map((key) => ({
      kind: "decklist" as const,
      createdAt: key.createdAt,
      key,
    })),
  ].toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));

  const decklistActions = {
    rename: (keyId: string, label: string) => renameDecklistKey.mutateAsync({ keyId, label }),
    renameState: renameDecklistKey,
    revoke: (keyId: string) => revokeDecklistKey.mutateAsync({ keyId }),
    revokePending: revokeDecklistKey.isPending,
    remove: (keyId: string) => removeDecklistKey.mutateAsync({ keyId }),
    removePending: removeDecklistKey.isPending,
  };

  return (
    <SettingsSection
      title={m.profile_deck_check_title()}
      description={m.profile_api_keys_description()}
      action={
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4" />
          {m.profile_deck_check_create_key()}
        </Button>
      }
    >
      {rows.length > 0 ? (
        <RowList>
          {rows.map((row) =>
            row.kind === "account" ? (
              <AccountKeyRow key={row.key.id} apiKey={row.key} />
            ) : (
              <DeckCheckKeyRow
                key={row.key.id}
                apiKey={row.key}
                actions={decklistActions}
                kindLabel={m.profile_api_keys_kind_decklist()}
              />
            ),
          )}
        </RowList>
      ) : (
        <Empty className="p-4">
          <EmptyDescription>{m.profile_deck_check_empty()}</EmptyDescription>
        </Empty>
      )}

      <CreateKeyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setMintedToken} />
      <MintedKeyDialog token={mintedToken} onClose={() => setMintedToken(null)} />
    </SettingsSection>
  );
}

function AccountKeyRow({ apiKey }: { apiKey: ApiKeyResponse }) {
  const deleteKey = useDeleteApiKey();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleRevoke() {
    if (await runReportedMutation(() => deleteKey.mutateAsync({ keyId: apiKey.id }))) {
      setConfirmOpen(false);
      toast.success(m.profile_deck_check_toast_revoked());
    }
  }

  return (
    <RowListItem className="gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {apiKey.name ?? m.profile_deck_check_unnamed()}{" "}
          {apiKey.start && (
            <Code className="text-muted-foreground font-normal">{apiKey.start}…</Code>
          )}
        </span>
        <span className="text-muted-foreground text-sm">{scopeSummary(apiKey)}</span>
        <span className="text-muted-foreground text-sm">
          {m.profile_deck_check_created({ date: formatDay(apiKey.createdAt) })}
          {" · "}
          {apiKey.expiresAt
            ? m.profile_api_keys_expires({ date: formatDay(apiKey.expiresAt) })
            : m.profile_api_keys_no_expiry()}
          {" · "}
          {apiKey.lastUsedAt
            ? m.profile_deck_check_last_used({ date: formatDay(apiKey.lastUsedAt) })
            : m.profile_deck_check_never_used()}
        </span>
      </div>
      <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
        {m.profile_deck_check_revoke()}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={m.profile_deck_check_revoke_confirm_title()}
        description={m.profile_api_keys_revoke_confirm_description()}
        confirmLabel={m.profile_deck_check_revoke()}
        isPending={deleteKey.isPending}
        onConfirm={() => void handleRevoke()}
      />
    </RowListItem>
  );
}

function CreateKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (token: string) => void;
}) {
  const createAccountKey = useCreateApiKey();
  const mintDecklistKey = useMintMyDeckCheckKey();
  const { data: adminAccess } = useAdminAccess();
  const canGrantAdmin =
    adminAccess !== undefined && (adminAccess.isAdmin || adminAccess.sections.length > 0);
  const [kind, setKind] = useState<KeyKind>("account");
  const [name, setName] = useState("");
  const [grants, setGrants] = useState(NO_GRANTS);
  const [expiry, setExpiry] = useState<ExpiryChoice>("90");
  const [admin, setAdmin] = useState(false);

  const pending = createAccountKey.isPending || mintDecklistKey.isPending;
  const error = kind === "account" ? createAccountKey.error : mintDecklistKey.error;
  const hasScope = admin || API_KEY_AREAS.some((area) => grants[area] !== "none");
  const canSubmit = name.trim() !== "" && (kind === "decklist" || hasScope);

  const expiryItems = [
    { value: "30" as const, label: m.profile_api_keys_expiry_30() },
    { value: "90" as const, label: m.profile_api_keys_expiry_90() },
    { value: "365" as const, label: m.profile_api_keys_expiry_365() },
    { value: "never" as const, label: m.profile_api_keys_expiry_never() },
  ];

  function reset() {
    setKind("account");
    setName("");
    setGrants(NO_GRANTS);
    setExpiry("90");
    setAdmin(false);
    createAccountKey.reset();
    mintDecklistKey.reset();
  }

  async function handleCreate() {
    if (!canSubmit) {
      return;
    }
    let token: string | undefined;
    const ok = await runReportedMutation(async () => {
      const created =
        kind === "account"
          ? await createAccountKey.mutateAsync({
              name: name.trim(),
              grants,
              admin,
              expiresInDays: expiry === "never" ? null : (Number(expiry) as 30 | 90 | 365),
            })
          : await mintDecklistKey.mutateAsync({ label: name.trim() });
      token = created.token;
    });
    if (ok && token !== undefined) {
      onOpenChange(false);
      onCreated(token);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          reset();
        } else {
          createAccountKey.reset();
          mintDecklistKey.reset();
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
          <RadioGroup
            value={kind}
            onValueChange={(value) => setKind(value === "decklist" ? "decklist" : "account")}
            aria-label={m.profile_api_keys_kind_label()}
            className="gap-0"
          >
            <RadioOptionRow
              value="account"
              title={m.profile_api_keys_kind_account()}
              description={m.profile_api_keys_kind_account_description()}
            />
            <RadioOptionRow
              value="decklist"
              title={m.profile_api_keys_kind_decklist()}
              description={m.profile_api_keys_kind_decklist_description()}
            />
          </RadioGroup>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="api-key-name">{m.profile_deck_check_name_label()}</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                kind === "account"
                  ? m.profile_api_keys_account_placeholder()
                  : m.profile_deck_check_name_placeholder()
              }
              maxLength={120}
            />
          </div>
          {kind === "account" && (
            <>
              <div className="flex flex-col gap-2">
                {API_KEY_AREAS.map((area) => (
                  <div key={area} className="flex flex-wrap items-center justify-between gap-2">
                    <span id={`api-key-area-${area}`}>{areaLabel(area)}</span>
                    <ToggleGroup
                      variant="outline"
                      spacing={0}
                      size="sm"
                      value={[grants[area]]}
                      aria-labelledby={`api-key-area-${area}`}
                      onValueChange={([next]) => {
                        if (next === "none" || next === "read" || next === "write") {
                          setGrants((prev) => ({ ...prev, [area]: next }));
                        }
                      }}
                    >
                      {(["none", "read", "write"] as const).map((grant) => (
                        <ToggleGroupItem key={grant} value={grant}>
                          {grantLabel(grant)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                ))}
              </div>
              <SimpleSelect
                items={expiryItems}
                value={expiry}
                onChange={setExpiry}
                label={m.profile_api_keys_expiry_label()}
              />
              {canGrantAdmin && (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="api-key-admin">{m.profile_api_keys_admin_label()}</Label>
                    <span className="text-muted-foreground text-sm">
                      {m.profile_api_keys_admin_description()}
                    </span>
                  </div>
                  <Switch id="api-key-admin" checked={admin} onCheckedChange={setAdmin} />
                </div>
              )}
            </>
          )}
          <SaveError error={error} />
          <DialogFooter>
            <DialogCancel />
            <Button type="submit" disabled={!canSubmit} pending={pending}>
              {m.profile_deck_check_create()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
