import { enumLabel } from "@openrift/shared/enum-label";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { CheckCheckIcon } from "lucide-react";

import { LanguageChip } from "@/components/language-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Pressable } from "@/components/ui/pressable";
import { renderLabeledValue } from "@/features/admin/components/candidate-cell-display";
import type {
  CandidateCardFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { PrintingLanguageHeader } from "@/features/admin/components/printing-language-header";
import {
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { usePrintingsByLanguage } from "@/features/admin/hooks/use-printings-by-language";
import { hasValue } from "@/features/admin/lib/candidate-cell-values";
import { firstPrintingSetLabel } from "@/features/admin/lib/card-overview";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import type { OverviewSourceGroup } from "@/features/admin/lib/source-groups";
import { useEnumOrders } from "@/hooks/use-enums";
import { useMarkers } from "@/hooks/use-markers";
import { getFilterIconPath } from "@/lib/icons";

interface TileLabels {
  rarities: Record<string, string>;
  finishes: Record<string, string>;
  markers: Record<string, string>;
  cardSizes: Record<string, string>;
}

function idParts(printing: AdminPrintingResponse, labels: TileLabels): string {
  const parts = [
    enumLabel(labels.finishes, printing.finish),
    ...printing.markerSlugs.map((slug) => enumLabel(labels.markers, slug)),
  ];
  if (printing.size !== WellKnown.cardSize.STANDARD) {
    parts.push(enumLabel(labels.cardSizes, printing.size));
  }
  return parts.join(" · ");
}

function PrintingTile({
  printing,
  detail,
  labels,
  onOpen,
}: {
  printing: AdminPrintingResponse;
  detail: AdminCardDetailResponse;
  labels: TileLabels;
  onOpen: (printingId: string) => void;
}) {
  const image = detail.printingImages.find(
    (candidate) => candidate.printingId === printing.id && candidate.isActive,
  );
  const rarityIcon = getFilterIconPath("rarities", printing.rarity);

  return (
    <Pressable
      className="hover:bg-muted/50 w-full space-y-1.5 rounded-md p-1.5"
      title={`Open ${printing.shortCode} in Printings`}
      onClick={() => onOpen(printing.id)}
    >
      <PrintingImageBox
        url={image === undefined ? null : printingImageDisplayUrl(image)}
        alt={printing.shortCode}
      />
      <span className="flex items-center gap-1.5 text-sm">
        <LanguageChip code={printing.language} />
        <span className="truncate">{printing.shortCode}</span>
      </span>
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {rarityIcon !== null && (
          <img
            src={rarityIcon}
            alt={enumLabel(labels.rarities, printing.rarity)}
            width={28}
            height={28}
            className="size-3.5 shrink-0"
          />
        )}
        <span className="truncate">{idParts(printing, labels)}</span>
      </span>
      {image === undefined && <Badge variant="destructive">No image</Badge>}
    </Pressable>
  );
}

export function CardOverviewSection({
  detail,
  card,
  cardFields,
  sourceGroups,
  attentionCount,
  invalidates,
  isAdmin,
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
  onOpenPrinting: (printingId: string) => void;
  onOpenAttention: () => void;
}) {
  const { labels: enumLabels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const tileLabels: TileLabels = {
    rarities: enumLabels.rarities,
    finishes: enumLabels.finishes,
    cardSizes: enumLabels.cardSizes,
    markers: Object.fromEntries(markersData.markers.map((marker) => [marker.slug, marker.label])),
  };
  const checkSource = useCheckCandidateCard(invalidates);
  const checkPrintings = useCheckAllCandidatePrintings(invalidates);

  const filled = cardFields.filter((field) => !field.readOnly && hasValue(card[field.key]));
  const byLanguage = usePrintingsByLanguage(detail.printings);
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
          <h3 className="text-sm font-medium">Facts</h3>
          <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
            <div className="contents">
              <dt className="text-muted-foreground">Card ID</dt>
              <dd className="font-mono">{detail.card?.slug ?? detail.expectedCardId}</dd>
            </div>
            <div className="contents">
              <dt className="text-muted-foreground">First set</dt>
              <dd>{firstPrintingSetLabel(detail.printings) ?? "—"}</dd>
            </div>
            {filled.map((field) => (
              <div key={field.key} className="contents">
                <dt className="text-muted-foreground">{field.label}</dt>
                <dd className="break-words whitespace-pre-wrap">
                  {renderLabeledValue(field, card[field.key])}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">
            Printings{detail.printings.length > 0 ? ` (${detail.printings.length})` : ""}
          </h3>
          {byLanguage.length === 0 ? (
            <p className="text-muted-foreground text-sm">No printings yet.</p>
          ) : (
            byLanguage.map(([language, printings]) => (
              <div key={language} className="space-y-1.5">
                <PrintingLanguageHeader code={language} className="rounded-md" />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,8rem))] items-start gap-2">
                  {printings.map((printing) => (
                    <PrintingTile
                      key={printing.id}
                      printing={printing}
                      detail={detail}
                      labels={tileLabels}
                      onOpen={onOpenPrinting}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        {attentionCount > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Attention</h3>
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
          <h3 className="text-sm font-medium">Sources</h3>
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
