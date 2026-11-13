import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

export function MetaItem({
  icon: Icon,
  truncate = false,
  className,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  truncate?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Icon className="size-4 shrink-0" />
      {truncate ? <span className="truncate">{children}</span> : children}
    </span>
  );
}
