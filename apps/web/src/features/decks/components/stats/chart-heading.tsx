import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";

export function ChartHeading({
  title,
  detail,
  control,
}: {
  title?: string;
  detail?: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="mb-2 flex h-7 items-center gap-2">
      {control ?? (
        <SectionHeading as="h3" size="sm">
          {title}
        </SectionHeading>
      )}
      {detail ? <span className="text-muted-foreground text-xs tabular-nums">{detail}</span> : null}
    </div>
  );
}
