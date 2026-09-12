import { Link } from "@tanstack/react-router";
import { PlusIcon, TrophyIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { buttonVariants } from "@/components/ui/button";
import { TournamentsOverview } from "@/features/tournaments/components/tournaments-overview";
import { useTournaments } from "@/features/tournaments/hooks/use-tournaments";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function TournamentsListPage() {
  const { data } = useTournaments();

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.nav_tournaments()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton render={<Link to="/tournaments/new" />}>
              <PlusIcon /> {m.tournaments_list_new()}
            </PageTopBarPrimaryButton>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <PageDescription>{m.tournaments_list_description()}</PageDescription>

        {data.items.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={TrophyIcon}
            title={m.tournaments_list_empty_title()}
            description={m.tournaments_list_empty_description()}
          >
            <Link to="/tournaments/new" className={buttonVariants({ variant: "default" })}>
              <PlusIcon />
              {m.tournaments_list_new()}
            </Link>
          </EmptyState>
        ) : (
          <TournamentsOverview
            tournaments={data.items}
            noUpcomingText={m.tournaments_list_no_upcoming()}
            showContext
          />
        )}
      </div>
    </>
  );
}
