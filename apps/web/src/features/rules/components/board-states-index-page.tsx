import type {
  BoardStateResponse,
  FeaturedBoardStateResponse,
} from "@openrift/shared/types/api/board-state";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { RulesPinBadges } from "@/features/rules/components/board-state-view";
import { useFeaturedBoardStates } from "@/features/rules/hooks/use-board-states";
import { boardStatesQueryOptions } from "@/features/rules/lib/board-states-queries";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function BoardStatesIndexPage() {
  const userId = useUserId();
  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.board_states_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton
              render={
                <Link to="/board-states/new">
                  <PlusIcon />
                  {m.board_states_new()}
                </Link>
              }
            />
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP, "flex flex-col gap-6 pt-3 pb-8")}>
        <PageDescription>{m.board_states_description()}</PageDescription>
        <FeaturedSection />
        {userId ? <MineSection userId={userId} /> : null}
      </div>
    </>
  );
}

function RowMeta({ item }: { item: BoardStateResponse | FeaturedBoardStateResponse }) {
  return (
    <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
      <RulesPinBadges pins={item} />
      {m.board_states_steps_count({ count: item.document.steps.length })}
    </span>
  );
}

function FeaturedSection() {
  const { data: items } = useFeaturedBoardStates();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{m.board_states_featured()}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{m.board_states_featured_empty()}</p>
      ) : (
        <ul className="bg-card divide-border border-border divide-y rounded-md border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 p-3">
              <Link
                to="/board/$token"
                params={{ token: item.shareToken }}
                className="font-semibold"
              >
                {item.title}
              </Link>
              <RowMeta item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MineSection({ userId }: { userId: string }) {
  const { data: items } = useQuery(boardStatesQueryOptions(userId));
  if (!items) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{m.board_states_mine()}</h2>
      {items.length === 0 ? (
        <div className="flex flex-col gap-1">
          <p className="font-semibold">{m.board_states_mine_empty_title()}</p>
          <p className="text-muted-foreground">{m.board_states_mine_empty_description()}</p>
        </div>
      ) : (
        <ul className="bg-card divide-border border-border divide-y rounded-md border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-1 p-3">
              <Link
                to="/board-states/$boardStateId"
                params={{ boardStateId: item.id }}
                className="font-semibold"
              >
                {item.title}
              </Link>
              <RowMeta item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
