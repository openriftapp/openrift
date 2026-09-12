import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { Fragment } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { useOnboardingStore } from "@/features/account/stores/onboarding-store";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
import { m } from "@/paraglide/messages.js";

const PREVIEW_LIMIT = 3;

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
  const preview = items.slice(0, PREVIEW_LIMIT);
  const rest = count - preview.length;
  const title = single
    ? m.collections_stats_missing_images_title_one()
    : m.collections_stats_missing_images_title_other({ count });

  return (
    <Callout className="mb-3 flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">{title}</span>{" "}
          {single
            ? m.collections_stats_missing_images_hint_one()
            : m.collections_stats_missing_images_hint_other()}
        </p>
        <p className="text-muted-foreground text-sm">
          {preview.map((item, index) => (
            <Fragment key={item.printingId}>
              {index > 0 ? " · " : null}
              <TextLink
                render={
                  <Link
                    to="/contribute/card/$cardSlug/printing/$printingId/image"
                    params={{ cardSlug: item.cardSlug, printingId: item.printingId }}
                  />
                }
              >
                {item.cardName}
              </TextLink>
            </Fragment>
          ))}
          {rest > 0 ? ` ${m.collections_stats_missing_images_more({ count: rest })}` : null}
        </p>
      </div>
      <div className="-my-1 flex shrink-0 items-center gap-1">
        <Button size="sm" render={<Link to="/contribute" />}>
          {single
            ? m.collections_stats_missing_images_add_one()
            : m.collections_stats_missing_images_add_other()}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            dismiss(items.map((item) => item.printingId));
          }}
          aria-label={m.collections_stats_missing_images_dismiss()}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </Callout>
  );
}
