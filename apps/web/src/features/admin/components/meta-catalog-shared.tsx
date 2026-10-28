import type { MetaSyncTriggerResult } from "@openrift/shared/contracts/admin/meta-catalog";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MetaMirrorRow } from "@/features/admin/lib/meta-mirror-rows";
import { syncTriggerAnnouncement } from "@/features/meta/lib/meta-catalog-display";
import { useDeckFormatList } from "@/hooks/use-enums";

export function announceSyncTrigger(label: string, result: MetaSyncTriggerResult): void {
  const announcement = syncTriggerAnnouncement(label, result);
  const options =
    announcement.description === "" ? undefined : { description: announcement.description };
  if (announcement.ok) {
    toast.success(announcement.title, options);
    return;
  }
  toast.error(announcement.title, options);
}

export function MetaMirrorFormatDialog({
  row,
  pending,
  onCancel,
  onConfirm,
}: {
  row: MetaMirrorRow | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (format: string) => void;
}) {
  const { formats } = useDeckFormatList();
  const [format, setFormat] = useState("");

  if (row === null) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which format is &ldquo;{row.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {row.unmappedFormat === ""
              ? "The source gives no format for this event."
              : `The source calls it "${row.unmappedFormat}", which maps to none of our formats.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="meta-mirror-publish-format">Format</Label>
          <Select
            items={formats.map((entry) => ({ value: entry.slug, label: entry.label }))}
            value={format}
            onValueChange={(next) => setFormat(next ?? "")}
          >
            <SelectTrigger id="meta-mirror-publish-format" className="w-full">
              <SelectValue placeholder="Pick a format" />
            </SelectTrigger>
            <SelectContent>
              {formats.map((entry) => (
                <SelectItem key={entry.slug} value={entry.slug}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogCancel />
          <Button disabled={format === ""} pending={pending} onClick={() => onConfirm(format)}>
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
