import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { ShowMoreButton } from "@/components/show-more-button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { RowList } from "@/components/ui/row-list";
import { Table, TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { m } from "@/paraglide/messages.js";

export function MetaFinishesSection({
  total,
  emptyMessage,
  canExpand,
  expanded,
  onToggleExpanded,
  remaining,
  loadingMore = false,
  onShowMore,
  columns,
  tableRows,
  phoneRows,
}: {
  total: number;
  emptyMessage: string;
  canExpand: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  remaining: number;
  loadingMore?: boolean;
  onShowMore: () => void;
  columns: ReactNode;
  tableRows: ReactNode;
  phoneRows: ReactNode;
}) {
  if (total === 0) {
    return (
      <section className="flex flex-col gap-3">
        <Heading>{m.meta_finishes_heading()}</Heading>
        <Empty>
          <EmptyHeader>
            <EmptyDescription>{emptyMessage}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Heading>{m.meta_finishes_heading()}</Heading>
        {canExpand && (
          <ShowMoreButton
            placement="heading"
            count={total}
            expanded={expanded}
            onClick={onToggleExpanded}
          />
        )}
      </div>

      <div>
        <Table variant="divided" className="hidden table-fixed sm:table">
          <TableHeader>
            <TableRow>{columns}</TableRow>
          </TableHeader>
          <TableBody>{tableRows}</TableBody>
        </Table>
        <RowList variant="divided" className="sm:hidden">
          {phoneRows}
        </RowList>

        {expanded && remaining > 0 && (
          <ShowMoreButton pending={loadingMore} onClick={onShowMore}>
            {m.meta_finishes_more({ count: remaining })}
          </ShowMoreButton>
        )}
      </div>
    </section>
  );
}
