import { SearchIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { useLinkCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";

export function AssignButton({
  normalizedName,
  allCards,
  linkCard,
}: {
  normalizedName: string;
  allCards: AdminSearchableCard[];
  linkCard: ReturnType<typeof useLinkCard>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const results = useAdminCardSearch(allCards, search);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Assign to another card"
            title="Assign to another card"
          />
        }
      >
        <SearchIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <CardSearchDropdown
          results={results}
          onSearch={setSearch}
          onSelect={(cardId) => {
            linkCard.mutate({ name: normalizedName, cardId });
            setSearch("");
            setOpen(false);
          }}
          placeholder="Search by name…"
          className="w-full"
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only UI, autofocus is intentional
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
