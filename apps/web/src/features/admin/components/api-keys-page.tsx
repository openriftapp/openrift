import { formatDay } from "@openrift/shared/format-date";
import { KeyRoundIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { CopyTextButton } from "@/components/copy-text-button";
import { EmptyState } from "@/components/empty-state";
import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiKeySummary } from "@/features/account/hooks/use-api-keys";
import {
  useApiKeys,
  useCreateApiKey,
  useDeleteApiKey,
} from "@/features/account/hooks/use-api-keys";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import type { AdminCellSlotProps } from "@/features/admin/components/admin-table";
import { AdminTable } from "@/features/admin/components/admin-table";

/**
 * Formats a better-auth date (a Date on the type, an ISO string on the wire).
 */
function keyDate(value: Date | string | null): string {
  if (!value) {
    return "—";
  }
  const iso = typeof value === "string" ? value : value.toISOString();
  return formatDay(iso);
}

function CreatedKeyDialog({ createdKey, onClose }: { createdKey: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            This is the only time the key is shown — only a hash is stored. Copy it now.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted rounded-md p-3 font-mono text-sm break-all select-all">
          {createdKey}
        </div>
        <DialogFooter>
          {/* The key must never end up in a QR. */}
          <CopyTextButton label="Copy key" value={createdKey} />
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevokeKeyCell({ row: apiKey }: AdminCellSlotProps<ApiKeySummary>) {
  const deleteKey = useDeleteApiKey();
  if (!apiKey) {
    return null;
  }

  return (
    <ConfirmActionButton
      title={`Revoke “${apiKey.name ?? apiKey.start}”?`}
      description="Scripts using this key stop working immediately. This cannot be undone."
      confirmLabel="Revoke"
      onConfirm={async () => {
        await deleteKey.mutateAsync({ keyId: apiKey.id });
        toast.success("API key revoked");
      }}
      trigger={<Button size="sm" variant="ghost" aria-label="Revoke key" />}
    >
      <TrashIcon className="size-4" />
    </ConfirmActionButton>
  );
}

function KeyStartCell({ row: apiKey }: AdminCellSlotProps<ApiKeySummary>) {
  return <span className="font-mono">{apiKey?.start ? `${apiKey.start}…` : "—"}</span>;
}

function TextCell({
  row,
  value,
  className,
}: AdminCellSlotProps<ApiKeySummary> & {
  value: (row: ApiKeySummary) => string | number;
  className?: string;
}) {
  return row ? <span className={className}>{value(row)}</span> : null;
}

export function ApiKeysPage() {
  const { data: keys, isPending } = useApiKeys();
  const createKey = useCreateApiKey();
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    try {
      const created = await createKey.mutateAsync({ name: trimmed });
      setName("");
      setCreatedKey(created.key);
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageTopBar title="API Keys" />

      <Card>
        <CardHeader>
          <CardTitle>Create key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            API keys let scripts call the API without a browser session: send the key as an{" "}
            <code className="font-mono">x-api-key</code> header and the request runs as your
            account, with all of its permissions. Keys don&apos;t expire, but each is limited to
            1000 requests per hour.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleCreate();
                  }
                }}
                placeholder="e.g. upload-script"
                className="w-56"
              />
            </div>
            <Button
              onClick={() => void handleCreate()}
              disabled={!name.trim()}
              pending={createKey.isPending}
            >
              <PlusIcon className="size-4" />
              Create key
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <Heading level={2}>Your keys</Heading>
        {isPending ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !keys || keys.length === 0 ? (
          <EmptyState
            icon={KeyRoundIcon}
            title="No API keys"
            description="Keys you create appear here. Only the first characters are kept for display."
          />
        ) : (
          <AdminTable
            columns={[
              { header: "Name", cell: <TextCell value={(key) => key.name ?? "—"} /> },
              { header: "Key", cell: <KeyStartCell /> },
              { header: "Created", cell: <TextCell value={(key) => keyDate(key.createdAt)} /> },
              {
                header: "Last used",
                cell: <TextCell value={(key) => keyDate(key.lastRequest)} />,
              },
              {
                header: "Requests",
                align: "right",
                cell: <TextCell value={(key) => key.requestCount} className="tabular-nums" />,
              },
            ]}
            data={keys}
            getRowKey={(key) => key.id}
            actions={<RevokeKeyCell />}
          />
        )}
      </section>

      {createdKey && (
        <CreatedKeyDialog createdKey={createdKey} onClose={() => setCreatedKey(null)} />
      )}
    </div>
  );
}
