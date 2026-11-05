import type { ReactNode } from "react";
import { createContext, use } from "react";

import { cn } from "@/lib/utils";

export const LabelledRowLayoutContext = createContext<"inline" | "stacked">("inline");

export function LabelledRow({
  label,
  labelClassName,
  className,
  aside,
  children,
}: {
  label: string;
  labelClassName?: string;
  className?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const layout = use(LabelledRowLayoutContext);
  if (layout === "stacked") {
    return (
      <div data-slot="labelled-row" className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <div className="flex min-h-5 items-center justify-between gap-2">
          <p
            className={cn(
              "text-muted-foreground text-xs font-medium tracking-wide uppercase",
              labelClassName,
            )}
          >
            {label}
          </p>
          {aside}
        </div>
        {children}
      </div>
    );
  }
  return (
    <div data-slot="labelled-row" className={cn("flex min-w-0 items-baseline gap-2", className)}>
      <p className={cn("text-muted-foreground w-18 shrink-0 text-xs font-medium", labelClassName)}>
        {label}
      </p>
      {children}
      {aside}
    </div>
  );
}
