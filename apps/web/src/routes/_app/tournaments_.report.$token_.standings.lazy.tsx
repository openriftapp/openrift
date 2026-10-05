import { createLazyFileRoute } from "@tanstack/react-router";

import { ReportStandingsPage } from "@/features/tournaments/components/report-standings-page";

export const Route = createLazyFileRoute("/_app/tournaments_/report/$token_/standings")({
  component: ReportStandingsPage,
});
