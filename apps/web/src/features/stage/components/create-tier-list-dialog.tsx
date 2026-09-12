import { useNavigate } from "@tanstack/react-router";
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
import { useCreateTierList } from "@/features/stage/hooks/use-tier-lists";
import { m } from "@/paraglide/messages.js";

interface CreateTierListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTierListDialog({ open, onOpenChange }: CreateTierListDialogProps) {
  const [title, setTitle] = useState("");
  const navigate = useNavigate();
  const createTierList = useCreateTierList();

  const trimmedTitle = title.trim();

  const handleCreate = () => {
    createTierList.mutate(
      { title: trimmedTitle },
      {
        onSuccess: (created) => {
          onOpenChange(false);
          setTitle("");
          void navigate({ to: "/tier-lists/$tierListId", params: { tierListId: created.id } });
        },
        // No toast: the global mutation error handler owns the failure message.
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.tier_lists_new()}</DialogTitle>
          <DialogDescription>{m.tier_lists_create_description()}</DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="new-tier-list-title">{m.tier_lists_field_title()}</FieldLabel>
          <Input
            id="new-tier-list-title"
            value={title}
            maxLength={120}
            placeholder={m.tier_lists_field_title_placeholder()}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {m.common_cancel()}
          </Button>
          <Button onClick={handleCreate} disabled={trimmedTitle === "" || createTierList.isPending}>
            {m.common_create()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
