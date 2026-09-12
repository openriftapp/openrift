import * as React from "react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).
//
// The flat label/value list: a two-column grid with muted labels and each
// pair on a shared baseline. No box and no hairlines; a group of lists
// separates by spacing.

function DefinitionList({ className, ...props }: React.ComponentProps<"dl">) {
  return (
    <dl
      data-slot="definition-list"
      className={cn(
        "grid grid-cols-[max-content_minmax(0,1fr)] items-baseline gap-x-4 gap-y-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

function DefinitionTerm({
  icon,
  className,
  children,
  ...props
}: React.ComponentProps<"dt"> & { icon?: React.ReactNode }) {
  return (
    <dt
      data-slot="definition-term"
      className={cn(
        "text-muted-foreground font-medium",
        icon !== undefined && "flex items-center gap-2",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </dt>
  );
}

function DefinitionDetail({ className, ...props }: React.ComponentProps<"dd">) {
  return <dd data-slot="definition-detail" className={cn("min-w-0", className)} {...props} />;
}

export { DefinitionList, DefinitionTerm, DefinitionDetail };
