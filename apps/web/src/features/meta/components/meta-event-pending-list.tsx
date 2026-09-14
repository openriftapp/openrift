import type { MetaPendingSubmission } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { formatRank } from "@/features/meta/lib/meta-format";
import { metaSubmissionKindLabels } from "@/features/meta/lib/meta-submission-copy";
import { m } from "@/paraglide/messages.js";

export function MetaEventPendingList({ items }: { items: readonly MetaPendingSubmission[] }) {
  if (items.length === 0) {
    return null;
  }
  const kinds = metaSubmissionKindLabels();

  return (
    <section className="mt-8">
      <Heading className="mb-1">{m.meta_pending_heading()}</Heading>
      <p className="text-muted-foreground mb-3">{m.meta_pending_description()}</p>
      <ul className="[&>li+li]:border-t">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 py-2">
            <span className="font-medium">{item.playerName ?? m.meta_pending_event_details()}</span>
            {item.rank !== null && (
              <span className="text-muted-foreground tabular-nums">
                {formatRank(item.rank, item.rankIsTier ?? false)}
              </span>
            )}
            <span className="text-muted-foreground">{kinds[item.kind]}</span>
            {item.mine && (
              <TextLink render={<Link to="/meta/submissions" />}>
                <Badge variant="muted">{m.meta_pending_yours()}</Badge>
              </TextLink>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
