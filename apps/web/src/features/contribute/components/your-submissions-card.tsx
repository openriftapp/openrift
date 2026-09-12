import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardSubmissionSummary } from "@/features/contribute/hooks/use-card-submission-summary";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="font-heading text-3xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

export function YourSubmissionsCard({ className }: { className?: string }) {
  const { data, isPending } = useCardSubmissionSummary();

  return (
    <section className={cn("flex flex-col items-start gap-3", className)}>
      <SectionHeading>{m.contribute_your_submissions_title()}</SectionHeading>
      {isPending ? <Skeleton className="h-12 w-48" /> : null}
      {data ? (
        <dl className="flex gap-8">
          <Figure label={m.contribute_status_pending()} value={data.pending} />
          <Figure label={m.contribute_status_accepted()} value={data.accepted} />
        </dl>
      ) : null}
      <Button variant="outline" size="sm" render={<Link to="/contribute/submissions" />}>
        {m.contribute_your_submissions_see_all()}
      </Button>
    </section>
  );
}
