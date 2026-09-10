import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import type {
  AdminCardDetailResponse,
  AdminPrintingImageResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";

import { LanguageChip } from "@/components/language-chip";
import { Badge } from "@/components/ui/badge";
import { CardList } from "@/components/ui/card-list";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Skeleton } from "@/components/ui/skeleton";
import { CardDetail } from "@/features/cards/components/card-detail/card-detail";
import { usePublicCardPreview } from "@/features/catalog-admin/hooks/use-public-card-preview";
import { hasFieldValue } from "@/features/catalog-admin/lib/catalog-field-labels";

function activeImage(
  printingId: string,
  images: readonly AdminPrintingImageResponse[],
): AdminPrintingImageResponse | undefined {
  return images.find((image) => image.printingId === printingId && image.isActive);
}

function printingMarkerLabel(printing: AdminPrintingResponse): string {
  const parts = [printing.finish, ...printing.markerSlugs].filter((part) => hasFieldValue(part));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function PublicPreview({ cardSlug }: { cardSlug: string }) {
  const { data, isLoading } = usePublicCardPreview(cardSlug);

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const printing = data?.printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank).at(0);
  if (!printing) {
    return (
      <p className="text-muted-foreground text-sm">
        No public page yet. It appears once the catalog serves a printing for this card.
      </p>
    );
  }
  return <CardDetail printing={printing} showImages showPrices={false} />;
}

function PrintingTiles({ detail }: { detail: AdminCardDetailResponse }) {
  return (
    <div className="flex flex-wrap gap-3">
      {detail.printings.map((printing) => {
        const image = activeImage(printing.id, detail.printingImages);
        const url = image?.rehostedUrl ?? image?.originalUrl ?? null;
        return (
          <div key={printing.id} className="w-32 space-y-1.5">
            <div className="bg-muted/30 aspect-card flex items-center justify-center overflow-hidden rounded-md border">
              {url ? (
                <ImgWithFallback
                  src={url}
                  alt={printing.shortCode}
                  className="size-full object-contain"
                  fallback={<span className="text-muted-foreground text-xs">Failed to load</span>}
                />
              ) : (
                <span className="text-muted-foreground text-xs">No image</span>
              )}
            </div>
            <p className="flex items-center gap-1.5 truncate text-sm">
              <LanguageChip code={printing.language} />
              <span className="truncate">{printing.shortCode}</span>
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {printingMarkerLabel(printing)}
            </p>
            {!url && <Badge variant="destructive">No image</Badge>}
          </div>
        );
      })}
    </div>
  );
}

function Facts({ detail }: { detail: AdminCardDetailResponse }) {
  const printingCount = detail.printings.length;
  const withoutImage = detail.printings.filter(
    (printing) => activeImage(printing.id, detail.printingImages) === undefined,
  ).length;
  const firstSet =
    detail.printings.toSorted((a, b) => a.canonicalRank - b.canonicalRank).at(0)?.setName ??
    detail.printings.at(0)?.setSlug ??
    "—";

  const linkedByMarketplace = new Map<string, Set<string>>();
  for (const mapping of detail.marketplaceMappings) {
    const bucket = linkedByMarketplace.get(mapping.marketplace) ?? new Set<string>();
    bucket.add(mapping.targetPrintingId);
    linkedByMarketplace.set(mapping.marketplace, bucket);
  }
  const soldOn = [...linkedByMarketplace.entries()].map(
    ([marketplace, printings]) =>
      `${marketplaceLabel(marketplace)} ${printings.size}/${printingCount} linked`,
  );

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Card ID</dt>
      <dd className="font-mono">{detail.card?.slug ?? detail.expectedCardId}</dd>
      <dt className="text-muted-foreground">First set</dt>
      <dd>{firstSet}</dd>
      <dt className="text-muted-foreground">Printings</dt>
      <dd>
        {printingCount}
        {withoutImage > 0 ? ` · ${withoutImage} without an image` : ""}
      </dd>
      <dt className="text-muted-foreground">Sold on</dt>
      <dd>{soldOn.length > 0 ? soldOn.join(" · ") : "Nothing linked yet"}</dd>
    </dl>
  );
}

function Sources({ detail }: { detail: AdminCardDetailResponse }) {
  return (
    <CardList>
      {detail.sources.map((source) => (
        <li key={source.id} className="flex items-center gap-3 px-3 py-2">
          <span className="min-w-0 flex-1 truncate">
            {source.provider === USER_SUBMISSION_PROVIDER
              ? (source.submittedByName ?? "Contributor")
              : source.provider}
          </span>
          {source.provider === USER_SUBMISSION_PROVIDER && (
            <Badge variant="violet">Contributor</Badge>
          )}
          <Badge variant={source.checkedAt === null ? "warning" : "success"}>
            {source.checkedAt === null ? "Unchecked" : "Checked"}
          </Badge>
        </li>
      ))}
    </CardList>
  );
}

export function OverviewTab({
  detail,
  cardSlug,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">As shown on the site</h2>
        <PublicPreview cardSlug={cardSlug} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Printings</h2>
        {detail.printings.length === 0 ? (
          <p className="text-muted-foreground text-sm">No printings yet.</p>
        ) : (
          <PrintingTiles detail={detail} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Facts</h2>
        <Facts detail={detail} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sources</h2>
        {detail.sources.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sources.</p>
        ) : (
          <Sources detail={detail} />
        )}
      </section>
    </div>
  );
}
