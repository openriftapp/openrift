import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DangerZone({
  id,
  title,
  description,
  className,
  contentClassName,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card
      id={id}
      data-slot="danger-zone"
      className={cn("ring-destructive/50 scroll-mt-16", className)}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-wrap gap-2", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
