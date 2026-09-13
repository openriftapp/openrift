import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { PlusSquareIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { m } from "@/paraglide/messages.js";

export const NEW_COLLECTION_OPTION = "__new__";

interface CollectionRadioPickerProps {
  collections: CollectionResponse[];
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  idPrefix: string;
}

export function CollectionRadioPicker({
  collections,
  selectedId,
  onSelectedIdChange,
  newName,
  onNewNameChange,
  idPrefix,
}: CollectionRadioPickerProps) {
  return (
    <>
      <RadioGroup value={selectedId} onValueChange={(value) => onSelectedIdChange(String(value))}>
        {collections.map((collection) => {
          const inputId = `${idPrefix}-${collection.id}`;
          return (
            <label
              key={collection.id}
              htmlFor={inputId}
              className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
            >
              <RadioGroupItem id={inputId} value={collection.id} />
              <span className="min-w-0 flex-1 truncate font-medium">{collection.name}</span>
              {collection.isInbox ? (
                <Badge variant="secondary" className="shrink-0">
                  {m.collections_dialog_picker_inbox_badge()}
                </Badge>
              ) : null}
              {collection.groupName ? (
                <Badge variant="outline" className="max-w-32 shrink-0 truncate">
                  {collection.groupName}
                </Badge>
              ) : null}
              <span className="text-muted-foreground shrink-0 text-xs">
                {m.common_cards({ count: collection.copyCount })}
              </span>
            </label>
          );
        })}
        <label
          htmlFor={`${idPrefix}-new`}
          className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2"
        >
          <RadioGroupItem id={`${idPrefix}-new`} value={NEW_COLLECTION_OPTION} />
          <span className="flex-1 font-medium">{m.collections_dialog_picker_new()}</span>
          <PlusSquareIcon className="text-muted-foreground size-4 shrink-0" />
        </label>
      </RadioGroup>

      {selectedId === NEW_COLLECTION_OPTION ? (
        <Input
          value={newName}
          onChange={(event) => onNewNameChange(event.target.value)}
          placeholder={m.collections_dialog_collection_name_placeholder()}
          aria-label={m.collections_dialog_picker_new_name_label()}
        />
      ) : null}
    </>
  );
}
