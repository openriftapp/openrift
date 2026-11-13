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
  as = "div",
  valueClassName,
  className,
  children,
}: {
  value: ReactNode;
  label: ReactNode;
  size?: StatFigureSize;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  as?: "div" | "dl-item";
  valueClassName?: string;
  className?: string;
  children?: ReactNode;
}) {
  const inList = as === "dl-item";
  const ValueTag = inList ? "dd" : "span";
  const LabelTag = inList ? "dt" : "span";
  const valueNode = (
    <ValueTag
      data-slot="stat-figure-value"
      className={cn(
        "font-heading leading-none font-bold tabular-nums",
        VALUE_CLASS[size],
        valueClassName,
      )}
    >
      {value}
    </ValueTag>
  );
  const labelNode = (
    <LabelTag className={cn("text-muted-foreground flex items-center gap-1.5", LABEL_CLASS[size])}>
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      {label}
    </LabelTag>
  );
  return (
    <div
      data-slot="stat-figure"
      className={cn("flex gap-0.5", inList ? "flex-col-reverse" : "flex-col", className)}
    >
      {inList ? labelNode : valueNode}
      {inList ? valueNode : labelNode}
      {children}
    </div>
  );
}

export { StatFigure };
