import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function AdminTableGroupRow({
  colSpan,
  children,
  className,
}: {
  colSpan: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableRow
      className={cn(
        "hover:bg-transparent [&:first-child>td]:pt-2 [&>td]:pt-6 [&>td]:pb-2",
        className,
      )}
    >
      <TableCell colSpan={colSpan}>
        <SectionHeading as="h3" size="sm">
          {children}
        </SectionHeading>
      </TableCell>
    </TableRow>
  );
}
