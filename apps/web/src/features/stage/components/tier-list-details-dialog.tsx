import type { TierListResponse } from "@openrift/shared/types/api/tier-list";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateTierList } from "@/features/stage/hooks/use-tier-lists";
import { m } from "@/paraglide/messages.js";

interface TierListDetailsDialogProps {
  tierList: TierListResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TierListDetailsDialog({
  tierList,
  open,
  onOpenChange,
}: TierListDetailsDialogProps) {
  const [title, setTitle] = useState(tierList.title);
  const [description, setDescription] = useState(tierList.description ?? "");
  const updateTierList = useUpdateTierList();

  const trimmedTitle = title.trim();

  const handleSave = () => {
    updateTierList.mutate(
      { id: tierList.id, title: trimmedTitle, description },
      {
        onSuccess: () => onOpenChange(false),
        // No toast: the global mutation error handler owns the failure message.
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening starts from what is saved, so an abandoned edit doesn't
        // linger in the fields.
        if (next) {
          setTitle(tierList.title);
          setDescription(tierList.description ?? "");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.tier_lists_details_title()}</DialogTitle>
          <DialogDescription>{m.tier_lists_details_description()}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="tier-list-title">{m.tier_lists_field_title()}</FieldLabel>
          <Input
            id="tier-list-title"
            value={title}
            maxLength={120}
            placeholder={m.tier_lists_field_title_placeholder()}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="tier-list-description">
            {m.tier_lists_field_description()}
          </FieldLabel>
          <Textarea
            id="tier-list-description"
            value={description}
            maxLength={2000}
            rows={3}
            placeholder={m.tier_lists_field_description_placeholder()}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={handleSave} disabled={trimmedTitle === "" || updateTierList.isPending}>
            {m.common_save()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
