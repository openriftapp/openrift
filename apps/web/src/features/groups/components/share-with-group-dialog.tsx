import type { ComponentType, ReactNode, SVGProps } from "react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { m } from "@/paraglide/messages.js";

export type ShareWithGroupFlow = "prompt" | "manage";

export interface ShareWithGroupItem {
  id: string;
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  detail?: string;
}

export function ShareWithGroupDialog({
  open,
  onOpenChange,
  title,
  description,
  loadingLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  loadingLabel: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Suspense
          fallback={<div className="text-muted-foreground py-4 text-sm">{loadingLabel}</div>}
        >
          {children}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}

export function ShareWithGroupPicker({
  items,
  flow,
  emptyMessage,
  idPrefix,
  submitLabel,
  isPending,
  onShare,
  onOpenChange,
}: {
  items: readonly ShareWithGroupItem[];
  flow: ShareWithGroupFlow;
  emptyMessage: ReactNode;
  idPrefix: string;
  submitLabel: (count: number) => string;
  isPending: boolean;
  onShare: (ids: readonly string[]) => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(flow === "prompt" ? items.map((item) => item.id) : []),
  );

  if (items.length === 0) {
    return (
      <>
        <p className="text-muted-foreground">{emptyMessage}</p>
        <DialogFooter>
          <DialogCancel>{m.common_close()}</DialogCancel>
        </DialogFooter>
      </>
    );
  }

  const handleShare = async () => {
    await onShare(items.filter((item) => selectedIds.has(item.id)).map((item) => item.id));
    onOpenChange(false);
  };

  return (
    <DialogForm onSubmit={() => void handleShare()}>
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const checkboxId = `${idPrefix}-${item.id}`;
          const Icon = item.icon;
          return (
            <li key={item.id} className="flex items-center gap-3">
              <Checkbox
                id={checkboxId}
                checked={selectedIds.has(item.id)}
                disabled={isPending}
                onCheckedChange={(checked) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (checked === false) {
                      next.delete(item.id);
                    } else {
                      next.add(item.id);
                    }
                    return next;
                  });
                }}
              />
              <label
                htmlFor={checkboxId}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
              >
                <Icon className="text-muted-foreground size-4 shrink-0" />
                <span className="truncate font-medium">{item.name}</span>
                {item.detail === undefined ? null : (
                  <span className="text-muted-foreground shrink-0 text-xs">{item.detail}</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <DialogFooter>
        <DialogCancel disabled={isPending}>
          {flow === "prompt" ? m.share_lists_dialog_skip() : m.common_cancel()}
        </DialogCancel>
        <Button type="submit" disabled={selectedIds.size === 0} pending={isPending}>
          {submitLabel(selectedIds.size)}
        </Button>
      </DialogFooter>
    </DialogForm>
  );
}
