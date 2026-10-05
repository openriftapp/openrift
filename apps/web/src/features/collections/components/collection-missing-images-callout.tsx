import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import { NudgeCallout } from "@/components/nudge-callout";
import { buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { useMyMissingImages } from "@/features/contribute/hooks/use-missing-images";
import { m } from "@/paraglide/messages.js";
import { useOnboardingStore } from "@/stores/onboarding-store";

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

  const preview = items.slice(0, PREVIEW_LIMIT);
  const rest = count - preview.length;
  const title = m.collections_stats_missing_images_title({ count });

  return (
    <NudgeCallout
      className="mb-3"
      title={title}
      body={m.collections_stats_missing_images_hint({ count })}
      action={
        <Link to="/contribute" className={buttonVariants({ size: "sm" })}>
          {m.collections_stats_missing_images_add({ count })}
        </Link>
      }
      onDismiss={() => dismiss(items.map((item) => item.printingId))}
      dismissLabel={m.collections_stats_missing_images_dismiss()}
    >
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
    </NudgeCallout>
  );
}
