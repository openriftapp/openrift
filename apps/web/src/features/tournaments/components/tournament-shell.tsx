import type {
  PodReportResponse,
  PodTournamentStatus,
} from "@openrift/shared/types/api/pod-tournament";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTournamentReport } from "@/features/tournaments/hooks/use-tournament-run";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";

const STATUS_LABEL: Record<PodTournamentStatus, string> = {
  setup: "Not started",
  running: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type ReportTab = "rounds" | "standings";

function ReportTabLink({
  to,
  token,
  label,
  value,
  isActive,
}: {
  to: "/tournaments/report/$token" | "/tournaments/report/$token/standings";
  token: string;
  label: string;
  value: ReportTab;
  isActive: boolean;
}) {
  return (
    <TabsTrigger
      value={value}
      render={<Link to={to} params={{ token }} aria-current={isActive ? "page" : undefined} />}
    >
      {label}
    </TabsTrigger>
  );
}

export function TournamentReportFrame({
  token,
  active,
  render,
}: {
  token: string;
  active: ReportTab;
  render: (data: PodReportResponse) => ReactNode;
}) {
  const { data } = useTournamentReport(token);
  const live = data.rounds.some((round) => round.status === "reporting");
  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{data.tournamentName}</PageTopBarTitle>
          <Badge variant="secondary" className="shrink-0">
            {STATUS_LABEL[data.status]}
          </Badge>
          {live ? (
            <Badge variant="success" className="shrink-0" title="Updates automatically">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-current" />
              Live
            </Badge>
          ) : null}
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        <Tabs value={active} render={<nav />} className="border-b">
          <TabsList variant="line" className="-mb-px">
            <ReportTabLink
              to="/tournaments/report/$token"
              token={token}
              label="Rounds"
              value="rounds"
              isActive={active === "rounds"}
            />
            <ReportTabLink
              to="/tournaments/report/$token/standings"
              token={token}
              label="Standings"
              value="standings"
              isActive={active === "standings"}
            />
          </TabsList>
        </Tabs>
        {render(data)}
      </div>
    </>
  );
}
