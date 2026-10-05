import { Link } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { StatFigure } from "@/components/ui/stat-figure";
import { useCardSubmissionSummary } from "@/features/contribute/hooks/use-card-submission-summary";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function YourSubmissionsCard({ className }: { className?: string }) {
  const { data, isPending } = useCardSubmissionSummary();

  return (
    <section className={cn("flex flex-col items-start gap-3", className)}>
      <SectionHeading>{m.contribute_your_submissions_title()}</SectionHeading>
      {isPending ? <Skeleton className="h-12 w-48" /> : null}
      {data ? (
        <div className="flex gap-8">
          <StatFigure size="hero" label={m.contribute_status_pending()} value={data.pending} />
          <StatFigure size="hero" label={m.contribute_status_accepted()} value={data.accepted} />
        </div>
      ) : null}
      <Link
        to="/contribute/submissions"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {m.contribute_your_submissions_see_all()}
      </Link>
    </section>
  );
}
