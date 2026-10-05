import type { MetaEventDetail } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { MetaContributeBandShell } from "@/features/meta/components/meta-contribute-band";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

export function MetaEventContributeBand({
  event,
  entries,
  withLists,
  slug,
}: {
  event: MetaEventDetail;
  entries: number;
  withLists: number;
  slug: string;
}) {
  const userId = useUserId();

  if (entries === 0) {
    return null;
  }

  const missing = entries - withLists;
  const body =
    missing === 0
      ? m.meta_event_contribute_complete()
      : m.meta_event_contribute_missing({ missing, total: entries });

  return (
    <MetaContributeBandShell
      title={m.meta_event_contribute_title({ event: event.name })}
      description={body}
      action={
        userId === null ? (
          <Link
            to="/login"
            search={{ redirect: `/meta/${slug}/submit`, email: undefined }}
            className={buttonVariants()}
          >
            {m.meta_event_contribute_sign_in()}
          </Link>
        ) : (
          <Link to="/meta/$slug/submit" params={{ slug }} className={buttonVariants()}>
            {m.meta_event_contribute_add()}
          </Link>
        )
      }
    />
  );
}
