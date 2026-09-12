import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function LabelledRow({
  label,
  labelClassName,
  className,
  children,
}: {
  label: string;
  labelClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <p className={cn("text-muted-foreground w-18 shrink-0 text-xs font-medium", labelClassName)}>
        {label}
      </p>
      {children}
    </div>
  );
}
