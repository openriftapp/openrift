import type { MetaEventDetail, MetaEventPlayer } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { MetaContributeBandShell } from "@/features/meta/components/meta-contribute-band";
import { useUserId } from "@/lib/auth-session";

export function MetaEventContributeBand({
  event,
  players,
  slug,
}: {
  event: MetaEventDetail;
  players: readonly MetaEventPlayer[];
  slug: string;
}) {
  const userId = useUserId();

  if (players.length === 0) {
    return null;
  }

  const missing = players.filter((player) => player.shareToken === null).length;
  const body =
    missing === 0
      ? "Every entry has its decklist. Corrections are still welcome."
      : `${missing} of ${players.length} entries are still missing their decklist. Contributors are credited on every event.`;

  return (
    <MetaContributeBandShell
      title={`Were you at ${event.name}?`}
      description={body}
      action={
        userId === null ? (
          <Button
            render={
              <Link to="/login" search={{ redirect: `/meta/${slug}/submit`, email: undefined }} />
            }
          >
            Sign in to add a decklist
          </Button>
        ) : (
          <Button render={<Link to="/meta/$slug/submit" params={{ slug }} />}>
            Add a decklist
          </Button>
        )
      }
    />
  );
}
