import { formatDay } from "@openrift/shared/format-date";
import type { AdminMetaEvent } from "@openrift/shared/types/api/meta";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useMetaEventSearch } from "@/features/admin/hooks/use-admin-meta";
import { CatalogSearchCombobox } from "@/features/cards/components/card-search-dropdown";

function EventRow({ event }: { event: AdminMetaEvent }) {
  return (
    <>
      <span className="text-muted-foreground shrink-0 tabular-nums">
        {formatDay(event.eventDate)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{event.name}</span>
      <Badge variant="outline">{event.format}</Badge>
    </>
  );
}

export function MetaEventSearchPicker({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (metaEventId: string, name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const { data, isPending } = useMetaEventSearch(search);

  return (
    <CatalogSearchCombobox<AdminMetaEvent>
      results={data?.events ?? []}
      getKey={(event) => event.id}
      renderItem={(event) => <EventRow event={event} />}
      itemToInputValue={(event) => event.name}
      onQueryChange={setSearch}
      onSelect={(event) => onPick(event.id, event.name)}
      ariaLabel="Search all events"
      placeholder="Search all events…"
      emptyMessage="No matching events"
      loading={isPending}
      loadingText="Searching…"
      disabled={disabled}
      className="w-72"
    />
  );
}
