import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/features/account/stores/onboarding-store";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";

export function CollectionMissingImagesCallout() {
  const dismissedPrintings = useOnboardingStore((state) => state.dismissedMissingImagePrintings);
  const dismiss = useOnboardingStore((state) => state.dismissMissingImagesNudge);
  const { data } = useMyMissingImages();

  const items = data?.items ?? [];
  const count = items.length;
  const hasUndismissed = items.some((item) => !dismissedPrintings.includes(item.printingId));
  if (count === 0 || !hasUndismissed) {
    return null;
  }

  const single = count === 1;
  const title = single
    ? "1 card you own has no photo yet"
    : `${count} cards you own have no photo yet`;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{title}</span> You have{" "}
        {single ? "it" : "them"} in hand, so you&rsquo;re the one who can fix that.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" render={<Link to="/contribute" />}>
          {single ? "Add a photo" : "Add photos"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            dismiss(items.map((item) => item.printingId));
          }}
          aria-label="Dismiss the missing photos nudge"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
