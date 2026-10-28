import { getOrientation } from "@openrift/shared/card-orientation";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { CheckCheckIcon, PencilIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Pressable } from "@/components/ui/pressable";
import { AdminPrintingMatrix } from "@/features/admin/components/admin-printing-matrix";
import { renderLabeledValue } from "@/features/admin/components/candidate-cell-display";
import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import {
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import type { CardReviewNavSearch } from "@/features/admin/hooks/use-card-review-navigation";
import { hasValue } from "@/features/admin/lib/candidate-cell-values";
import { firstPrintingSetLabel } from "@/features/admin/lib/card-overview";
import type { OverviewSourceGroup } from "@/features/admin/lib/source-groups";

export function CardOverviewSection({
  detail,
  card,
  cardFields,
  sourceGroups,
  attentionCount,
  invalidates,
  isAdmin,
  cardSlug,
  listSearch,
  onOpenPrinting,
  onOpenAttention,
}: {
  detail: AdminCardDetailResponse;
  card: Record<string, unknown>;
  cardFields: FieldDef<CandidateCardFieldKey>[];
  sourceGroups: readonly OverviewSourceGroup[];
  attentionCount: number;
  invalidates: readonly (readonly unknown[])[];
  isAdmin: boolean;
  cardSlug: string;
  listSearch: CardReviewNavSearch;
  onOpenPrinting: (printingId: string) => void;
  onOpenAttention: () => void;
}) {
  const checkSource = useCheckCandidateCard(invalidates);
  const checkPrintings = useCheckAllCandidatePrintings(invalidates);

  const filled = cardFields.filter((field) => !field.readOnly && hasValue(card[field.key]));
  const landscape = getOrientation(detail.card?.types ?? []) === "landscape";
  function checkGroup(group: OverviewSourceGroup) {
    for (const candidateCardId of group.candidateCardIds) {
      checkSource.mutate(candidateCardId);
    }
    if (group.uncheckedPrintingIds.length > 0) {
      checkPrintings.mutate({ extraIds: group.uncheckedPrintingIds });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-6">
        <section className="space-y-2">
          <Heading level={3}>Facts</Heading>
          <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-start gap-x-6 gap-y-1.5 text-sm">
            <div className="contents">
              <dt className="text-muted-foreground">Card ID</dt>
              <dd className="col-span-2 font-mono">{detail.card?.slug ?? detail.expectedCardId}</dd>
            </div>
            <div className="contents">
              <dt className="text-muted-foreground">First set</dt>
              <dd className="col-span-2">{firstPrintingSetLabel(detail.printings) ?? "—"}</dd>
            </div>
            {filled.map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="break-words whitespace-pre-wrap">
                  {renderLabeledValue(field, card[field.key])}
                </dd>
                <dd>
                  <Link
                    to="/admin/cards/$cardSlug"
                    params={{ cardSlug }}
                    search={{ ...listSearch, section: "printings", focusField: field.key }}
                    aria-label={`Edit ${field.label}`}
                    className={buttonVariants({
                      variant: "ghost",
                      size: "icon-sm",
                      className: "-my-1",
                    })}
                  >
                    <PencilIcon />
                  </Link>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col gap-6">
          <Heading level={3}>
            Printings{detail.printings.length > 0 ? ` (${detail.printings.length})` : ""}
          </Heading>
          {detail.printings.length === 0 ? (
            <p className="text-muted-foreground text-sm">No printings yet.</p>
          ) : (
            <AdminPrintingMatrix detail={detail} landscape={landscape} onOpen={onOpenPrinting} />
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        {attentionCount > 0 && (
          <section className="space-y-2">
            <Heading level={3}>Needs a decision</Heading>
            <CardList>
              <li>
                <Pressable
                  className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm"
                  onClick={onOpenAttention}
                >
                  <Badge variant="count">{attentionCount}</Badge>
                  <span className="min-w-0 flex-1 truncate">waiting on a decision</span>
                </Pressable>
              </li>
            </CardList>
          </section>
        )}

        <section className="space-y-2">
          <Heading level={3}>Sources</Heading>
          {sourceGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sources.</p>
          ) : (
            <CardList>
              {sourceGroups.map((group) => (
                <li key={group.key} className="flex flex-col gap-1 px-3 py-2">
                  <span className="truncate text-sm">{group.label}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {group.isTrusted && <Badge variant="info">Trusted</Badge>}
                    {group.isContributor && <Badge variant="violet">Contributor</Badge>}
                    {group.isChecked ? (
                      <Badge variant="success">Checked</Badge>
                    ) : isAdmin ? (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={checkSource.isPending || checkPrintings.isPending}
                        onClick={() => checkGroup(group)}
                      >
                        <CheckCheckIcon />
                        Check
                      </Button>
                    ) : (
                      <Badge variant="warning">Unchecked</Badge>
                    )}
                    {group.rowCount > 1 && (
                      <span className="text-muted-foreground text-xs">{group.rowCount} rows</span>
                    )}
                  </span>
                </li>
              ))}
            </CardList>
          )}
        </section>
      </div>
    </div>
  );
}
