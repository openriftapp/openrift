import type { JobStatus } from "@openrift/shared/contracts/admin/job-runs";
import type { MetaSource } from "@openrift/shared/contracts/admin/meta-catalog";
import { Link } from "@tanstack/react-router";
import { CircleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetaToneDot } from "@/features/admin/components/meta-overview-shared";
import type { MetaAdminTarget } from "@/features/admin/lib/meta-admin-triggers";
import { catalogueSource, JOB_KIND_PREFIX } from "@/features/admin/lib/meta-admin-triggers";
import type { MetaSyncAlert, MetaSyncAlertTarget } from "@/features/meta/lib/meta-catalog-display";
import { META_SOURCE_LABELS } from "@/features/meta/lib/meta-catalog-display";

/** A union, not an optional `target`: a forgotten one must fail to compile, not link nowhere. */
type AlertDestination =
  | { kind: "runs"; label: string; status?: JobStatus }
  | { kind: "link"; label: string; target: MetaAdminTarget };

const ALERT_TARGETS: Record<MetaSyncAlertTarget, AlertDestination> = {
  runs: { kind: "runs", label: "Recent runs" },
  "failed-runs": { kind: "runs", label: "The failed runs", status: "failed" },
  "catalogue-accepted": {
    kind: "link",
    label: "Published events",
    target: { tab: "catalogue", triage: "accepted" },
  },
  "catalogue-accepted-missing": {
    kind: "link",
    label: "The missing events",
    target: { tab: "catalogue", triage: "accepted", missing: true },
  },
  "catalogue-accepted-cancelled": {
    kind: "link",
    label: "The cancelled events",
    target: { tab: "catalogue", triage: "accepted", eventStatus: "canceled" },
  },
  review: { kind: "link", label: "Review queue", target: { tab: "review" } },
};

function AlertAction({ alert, source }: { alert: MetaSyncAlert; source: MetaSource }) {
  const destination = ALERT_TARGETS[alert.target];
  if (destination.kind === "runs") {
    return (
      <Link
        to="/admin/job-runs"
        search={{ runPrefix: JOB_KIND_PREFIX[source], runStatus: destination.status }}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {destination.label}
      </Link>
    );
  }
  return (
    <Link
      from="/admin/meta"
      to="/admin/meta"
      search={(prev) => ({
        ...prev,
        detail: undefined,
        source: catalogueSource(source),
        ...destination.target,
      })}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      {destination.label}
    </Link>
  );
}

export type SourcedAlert = MetaSyncAlert & { source: MetaSource };

export function HealthCard({ alerts }: { alerts: SourcedAlert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MetaToneDot tone={alerts.length === 0 ? "ok" : "warn"} />
          {alerts.length === 0
            ? "No warnings"
            : `${alerts.length} ${alerts.length === 1 ? "warning" : "warnings"}`}
        </CardTitle>
      </CardHeader>
      {alerts.length > 0 && (
        <CardContent className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={`${alert.source}-${alert.id}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1"
            >
              <CircleAlertIcon className="text-warning size-4 shrink-0" />
              <Badge variant="neutral">{META_SOURCE_LABELS[alert.source]}</Badge>
              <span className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
                {alert.message}
              </span>
              <span className="ml-auto sm:ml-0">
                <AlertAction alert={alert} source={alert.source} />
              </span>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
