import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeskCardPrintings } from "@/features/admin/hooks/use-printing-desk";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useCards } from "@/features/cards/hooks/use-cards";
import { useCatalogCardSearch } from "@/features/cards/hooks/use-catalog-card-search";
import type { ExistingDraftFace } from "@/features/catalog-workspace/lib/creation-draft";
import { existingFacesFromDeskRows } from "@/features/catalog-workspace/lib/creation-draft";

function CardFaces({
  cardSlug,
  ownFacesOnly,
  excludeFaceIds,
  onPick,
}: {
  cardSlug: string;
  ownFacesOnly: boolean;
  excludeFaceIds: readonly string[];
  onPick: (face: ExistingDraftFace) => void;
}) {
  const { data } = useDeskCardPrintings(cardSlug);
  const faces = existingFacesFromDeskRows(data.printings).filter(
    (face) =>
      !excludeFaceIds.includes(face.faceId) && (!ownFacesOnly || face.cardSlug === cardSlug),
  );

  if (faces.length === 0) {
    return <p className="text-muted-foreground text-sm">This card has no other face to pick.</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {faces.map((face) => (
        <Button
          key={face.faceId}
          variant="outline"
          className="w-full justify-start"
          onClick={() => onPick(face)}
        >
          {face.label}
        </Button>
      ))}
    </div>
  );
}

function CardSearchStep({ onPick }: { onPick: (cardSlug: string) => void }) {
  const [query, setQuery] = useState("");
  const results = useCatalogCardSearch(query);
  const { cardsById } = useCards();

  return (
    <CardSearchDropdown
      results={results}
      onSearch={setQuery}
      onSelect={(cardId) => {
        const slug = cardsById[cardId]?.slug;
        if (slug) {
          onPick(slug);
        }
      }}
      placeholder="Search the catalog…"
      className="w-full"
      // oxlint-disable-next-line jsx-a11y/no-autofocus -- the dialog's first control
      autoFocus
    />
  );
}

export function FacePicker({
  open,
  onOpenChange,
  onPick,
  cardSlug,
  excludeFaceIds = [],
  title = "Pick existing face",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (face: ExistingDraftFace) => void;
  cardSlug?: string;
  excludeFaceIds?: readonly string[];
  title?: string;
}) {
  const [searchedSlug, setSearchedSlug] = useState<string | null>(null);
  const slug = cardSlug ?? searchedSlug;

  function close(next: boolean) {
    if (!next) {
      setSearchedSlug(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {slug === null
              ? "Pick the card the face belongs to."
              : "Its fields are read-only here. Edit them on the face."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            {slug === null ? (
              <CardSearchStep onPick={setSearchedSlug} />
            ) : (
              <div className="flex flex-col gap-3">
                <CardFaces
                  cardSlug={slug}
                  ownFacesOnly={cardSlug !== undefined}
                  excludeFaceIds={excludeFaceIds}
                  onPick={(face) => {
                    onPick(face);
                    close(false);
                  }}
                />
                {cardSlug === undefined && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchedSlug(null)}>
                    Another card
                  </Button>
                )}
              </div>
            )}
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
