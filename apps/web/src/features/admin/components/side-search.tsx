import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { Printing } from "@openrift/shared/types/catalog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCards } from "@/features/cards/hooks/use-cards";

const MAX_MATCHES = 8;

/** Finds an existing face by its code. Each face is offered once, however many printings show it. */
export function SideSearch({
  id,
  excludeFaceIds = [],
  disabled = false,
  onPick,
}: {
  id?: string;
  excludeFaceIds?: readonly string[];
  disabled?: boolean;
  onPick: (side: Printing) => void;
}) {
  const { allPrintings } = useCards();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const matches: Printing[] = [];
  if (needle.length >= 3) {
    const seen = new Set(excludeFaceIds);
    for (const side of allPrintings) {
      if (matches.length >= MAX_MATCHES) {
        break;
      }
      if (
        !seen.has(side.faceId) &&
        (side.shortCode.toLowerCase().includes(needle) ||
          side.publicCode.toLowerCase().includes(needle))
      ) {
        seen.add(side.faceId);
        matches.push(side);
      }
    }
  }

  return (
    <div className="space-y-2">
      <Input
        id={id}
        aria-label="Code of the other face"
        value={query}
        placeholder="SGN-T05"
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
      />
      {matches.map((side) => (
        <Button
          key={side.faceId}
          variant="outline"
          className="w-full justify-start"
          disabled={disabled}
          onClick={() => {
            onPick(side);
            setQuery("");
          }}
        >
          {side.card.name} · {formatPrintingCode(side.publicCode)} · {side.finish} · {side.language}
        </Button>
      ))}
    </div>
  );
}
