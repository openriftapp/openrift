import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

type StatFigureSize = "default" | "hero";

const VALUE_CLASS: Record<StatFigureSize, string> = {
  default: "text-2xl",
  hero: "text-3xl",
};

const LABEL_CLASS: Record<StatFigureSize, string> = {
  default: "text-xs",
  hero: "text-sm",
};

function StatFigure({
  value,
  label,
  size = "default",
  icon: Icon,
  valueClassName,
  className,
  children,
}: {
  value: ReactNode;
  label: ReactNode;
  size?: StatFigureSize;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  valueClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div data-slot="stat-figure" className={cn("flex flex-col gap-0.5", className)}>
      <span
        data-slot="stat-figure-value"
        className={cn(
          "font-heading leading-none font-bold tabular-nums",
          VALUE_CLASS[size],
          valueClassName,
        )}
      >
        {value}
      </span>
      <span className={cn("text-muted-foreground flex items-center gap-1.5", LABEL_CLASS[size])}>
        {Icon ? <Icon className="size-4 shrink-0" /> : null}
        {label}
      </span>
      {children}
    </div>
  );
}

export { StatFigure };
