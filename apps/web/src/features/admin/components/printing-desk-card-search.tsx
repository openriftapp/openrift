import { useNavigate } from "@tanstack/react-router";
import { Suspense } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CatalogCardSlugSearch } from "@/features/cards/components/catalog-card-slug-search";

export function PrintingDeskCardSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New printing</DialogTitle>
          <DialogDescription>
            Pick the card first. The next step shows every printing it already has.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <Suspense fallback={<Skeleton className="h-8 w-full" />}>
            <CatalogCardSlugSearch
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- admin-only dialog whose only control is this input
              autoFocus
              onPick={(cardSlug) => {
                onOpenChange(false);
                void navigate({
                  to: "/admin/printing-desk/cards/$cardSlug",
                  params: { cardSlug },
                });
              }}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
