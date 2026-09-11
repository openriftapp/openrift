import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MatchupCard({
  editable = false,
  collapsed = false,
  header,
  children,
}: {
  editable?: boolean;
  collapsed?: boolean;
  header: ReactNode;
  children?: ReactNode;
}) {
  if (!editable) {
    return (
      <Card className="gap-3 p-3">
        <div className="flex items-center gap-2">{header}</div>
        {children}
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 gap-0 p-0">
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-2",
          !collapsed && "border-b",
        )}
      >
        {header}
      </div>
      {collapsed ? null : <div className="space-y-3 p-3">{children}</div>}
    </Card>
  );
}
