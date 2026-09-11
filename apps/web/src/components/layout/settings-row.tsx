import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function SettingsRow({
  label,
  htmlFor,
  description,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div
        className={cn(
          "flex min-h-8 min-w-0 flex-col gap-0.5",
          description ? "pt-1.5" : "justify-center",
        )}
      >
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      <div className="flex min-h-8 shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}
