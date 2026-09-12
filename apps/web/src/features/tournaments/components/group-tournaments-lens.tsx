import { Link } from "@tanstack/react-router";
import { PlusIcon, TrophyIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { TournamentsOverview } from "@/features/tournaments/components/tournaments-overview";
import { useGroupTournaments } from "@/features/tournaments/hooks/use-tournaments";
import { m } from "@/paraglide/messages.js";

interface GroupTournamentsLensProps {
  slug: string;
  canCreate: boolean;
  groupId: string;
}

export function GroupTournamentsLens({ slug, canCreate, groupId }: GroupTournamentsLensProps) {
  const { data } = useGroupTournaments(slug);

  if (data.items.length === 0) {
    return (
      <EmptyState
        className="py-12"
        icon={TrophyIcon}
        title={m.tournaments_group_lens_empty_title()}
        description={
          canCreate
            ? m.tournaments_group_lens_empty_can_create()
            : m.tournaments_group_lens_empty_member()
        }
      >
        {canCreate ? (
          <Link
            to="/tournaments/new"
            search={{ group: groupId }}
            className={buttonVariants({ variant: "default" })}
          >
            <PlusIcon />
            {m.tournaments_group_lens_new_tournament()}
          </Link>
        ) : null}
      </EmptyState>
    );
  }

  return (
    <TournamentsOverview
      tournaments={data.items}
      noUpcomingText={
        canCreate
          ? m.tournaments_group_lens_no_upcoming_can_create()
          : m.tournaments_group_lens_no_upcoming()
      }
    />
  );
}
