import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { CheckIcon, EllipsisVerticalIcon, MessageSquareTextIcon, XIcon } from "lucide-react";
import { cloneElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CandidateSpreadsheetRow } from "@/features/admin/lib/candidate-rows";
import {
  getProviderLabel,
  isChecked,
  isFavoriteProvider,
} from "@/features/admin/lib/candidate-rows";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";
import { submitterLabel } from "@/features/admin/lib/candidate-submitter";
import { cn } from "@/lib/utils";

function SubmitterLine({
  submitter,
  showName = true,
}: {
  submitter: SourceSubmitter;
  showName?: boolean;
}) {
  const label = submitterLabel(submitter);
  return (
    <div className="text-muted-foreground flex items-center gap-1 font-normal">
      {showName && (
        <span className="min-w-0 truncate" title={label}>
          by {label}
        </span>
      )}
      {submitter.note !== null && (
        <Popover>
          <PopoverTrigger
            render={<Button variant="ghost" size="icon" className="size-5 shrink-0" />}
            aria-label="Show submission note"
          >
            <MessageSquareTextIcon className="size-3.5" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <p className="text-muted-foreground mb-1 font-medium">Submission note</p>
            <p className="whitespace-pre-wrap">{submitter.note}</p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export function CandidateSpreadsheetHeader<TRow extends CandidateSpreadsheetRow>({
  sortedRows,
  providerLabels,
  providerNames,
  submitters,
  favoriteProviders,
  onCheck,
  onUncheck,
  columnActions,
  columnClassName,
  activeColumnBadge,
}: {
  sortedRows: TRow[];
  providerLabels?: Record<string, string>;
  providerNames?: Record<string, string>;
  submitters?: Record<string, SourceSubmitter>;
  favoriteProviders: Set<string>;
  onCheck?: (candidateId: string) => void;
  onUncheck?: (candidateId: string) => void;
  columnActions?: React.ReactElement<{ row?: NoInfer<TRow> }>;
  columnClassName?: (row: NoInfer<TRow>) => string | undefined;
  activeColumnBadge?: React.ReactNode;
}) {
  return (
    <thead>
      <tr className="bg-muted/50 border-b">
        <th className="bg-muted/50 sticky left-0 z-10 w-40 px-3 py-2 text-left font-medium">
          Field
        </th>
        <th className="bg-success-soft w-64 border-l px-3 py-2 text-left font-medium">
          <span className="inline-flex items-center gap-1.5">
            On the site
            {activeColumnBadge}
          </span>
        </th>
        {sortedRows.map((row) => {
          // A printing row inherits attribution from its parent candidate card.
          const parentCardId = row.candidateCardId;
          const submitter = submitters?.[parentCardId ?? row.id];
          const providerLabel = getProviderLabel(row, providerLabels);
          const isContribution = providerLabel === USER_SUBMISSION_PROVIDER;
          const columnTitle = isContribution
            ? ((submitter === undefined ? null : submitterLabel(submitter)) ?? "Contributor")
            : providerLabel;
          return (
            <th
              key={row.id}
              className={cn(
                "w-64 border-l px-3 py-2 text-left font-medium",
                isFavoriteProvider(row, providerLabels, favoriteProviders) && "bg-info-soft",
                isChecked(row) && "opacity-50",
                columnClassName?.(row),
              )}
            >
              <div className="flex items-center gap-1">
                <span className="min-w-0 break-words">
                  {columnTitle}
                  {parentCardId !== undefined && providerNames?.[parentCardId] && (
                    <span className="text-muted-foreground ml-1">
                      ({providerNames[parentCardId]})
                    </span>
                  )}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon" className="ml-auto shrink-0" />}
                  >
                    <EllipsisVerticalIcon className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onCheck && !isChecked(row) && (
                      <DropdownMenuItem onClick={() => onCheck(row.id)}>
                        <CheckIcon className="mr-2 size-3.5" />
                        Mark as checked
                      </DropdownMenuItem>
                    )}
                    {onUncheck && isChecked(row) && (
                      <DropdownMenuItem onClick={() => onUncheck(row.id)}>
                        <XIcon className="mr-2 size-3.5" />
                        Mark as unchecked
                      </DropdownMenuItem>
                    )}
                    {columnActions ? cloneElement(columnActions, { row }) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 font-normal">
                {isFavoriteProvider(row, providerLabels, favoriteProviders) && (
                  <Badge variant="info">Trusted</Badge>
                )}
                <Badge variant={isChecked(row) ? "success" : "warning"}>
                  {isChecked(row) ? "Checked" : "Unchecked"}
                </Badge>
              </div>
              {submitter && (isContribution ? submitter.note !== null : true) && (
                <SubmitterLine submitter={submitter} showName={!isContribution} />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
