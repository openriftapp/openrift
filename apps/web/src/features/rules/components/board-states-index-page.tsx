import type {
  BoardStateResponse,
  FeaturedBoardStateResponse,
} from "@openrift/shared/types/api/board-state";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayoutGridIcon, PlusIcon } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import {
  PageDescription,
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { RulesPinBadges } from "@/features/rules/components/board-caption-text";
import { useFeaturedBoardStates } from "@/features/rules/hooks/use-board-states";
import { boardStatesQueryOptions } from "@/features/rules/lib/board-states-queries";
import { useUserId } from "@/lib/auth-session";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function BoardStatesIndexPage() {
  const userId = useUserId();
  return userId === null ? <IndexContent mine={null} /> : <SignedInIndex userId={userId} />;
}

function SignedInIndex({ userId }: { userId: string }) {
  const { data: mine } = useSuspenseQuery(boardStatesQueryOptions(userId));
  return <IndexContent mine={mine} />;
}

function IndexContent({ mine }: { mine: BoardStateResponse[] | null }) {
  const { data: featured } = useFeaturedBoardStates();
  const nothingToShow = featured.length === 0 && (mine === null || mine.length === 0);
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
        {nothingToShow ? (
          <BoardStatesEmpty />
        ) : (
          <>
            {featured.length > 0 ? (
              <ListSection title={m.board_states_featured()}>
                {featured.map((item) => (
                  <Row key={item.id} item={item}>
                    <Link
                      to="/board/$token"
                      params={{ token: item.shareToken }}
                      className="font-semibold"
                    >
                      {item.title}
                    </Link>
                  </Row>
                ))}
              </ListSection>
            ) : null}
            {mine === null ? null : mine.length === 0 ? (
              <BoardStatesEmpty />
            ) : (
              <ListSection title={m.board_states_mine()}>
                {mine.map((item) => (
                  <Row key={item.id} item={item}>
                    <Link
                      to="/board-states/$boardStateId"
                      params={{ boardStateId: item.id }}
                      className="font-semibold"
                    >
                      {item.title}
                    </Link>
                  </Row>
                ))}
              </ListSection>
            )}
          </>
        )}
      </div>
    </>
  );
}

function BoardStatesEmpty() {
  return (
    <EmptyState
      icon={LayoutGridIcon}
      title={m.board_states_empty_title()}
      description={m.board_states_empty_description()}
      className="py-12"
    >
      <Button render={<Link to="/board-states/new" />}>
        <PlusIcon />
        {m.board_states_new()}
      </Button>
    </EmptyState>
  );
}

function ListSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{title}</h2>
      <ul className="bg-card divide-border border-border divide-y rounded-md border">{children}</ul>
    </section>
  );
}

function Row({
  item,
  children,
}: {
  item: BoardStateResponse | FeaturedBoardStateResponse;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 p-3">
      {children}
      <span className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        <RulesPinBadges pins={item} />
        {m.board_states_steps_count({ count: item.document.steps.length })}
      </span>
    </li>
  );
}
