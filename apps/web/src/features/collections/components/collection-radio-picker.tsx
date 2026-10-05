import type { CollectionResponse } from "@openrift/shared/types/api/collection";
import { PlusSquareIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
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
        {collections.map((collection) => (
          <RadioOptionRow
            key={collection.id}
            id={`${idPrefix}-${collection.id}`}
            value={collection.id}
            title={collection.name}
            meta={
              <>
                {collection.isInbox ? (
                  <Badge variant="secondary">{m.collections_dialog_picker_inbox_badge()}</Badge>
                ) : null}
                {collection.groupName ? (
                  <Badge variant="outline" className="max-w-32 truncate">
                    {collection.groupName}
                  </Badge>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {m.common_cards({ count: collection.copyCount })}
                </span>
              </>
            }
          />
        ))}
        <RadioOptionRow
          id={`${idPrefix}-new`}
          value={NEW_COLLECTION_OPTION}
          title={m.collections_dialog_picker_new()}
          meta={<PlusSquareIcon className="text-muted-foreground size-4" />}
        />
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
