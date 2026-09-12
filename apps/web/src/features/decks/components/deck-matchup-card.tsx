import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

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
      <Card className="gap-4 p-4">
        <div className="flex items-center gap-2">{header}</div>
        {children}
      </Card>
    );
  }

  return (
    <Card className="bg-card/40 gap-0 divide-y p-0">
      <div className="flex items-center justify-between gap-2 p-4">{header}</div>
      {collapsed ? null : <div className="flex flex-col gap-4 p-4">{children}</div>}
    </Card>
  );
}
