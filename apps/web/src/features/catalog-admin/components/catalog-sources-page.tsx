import { adminCardQueriesContract } from "@openrift/shared/contracts/admin/card-queries";
import { formatDay } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BanIcon, DownloadIcon, Link2Icon, LoaderIcon, UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { useRelinkCandidatePrintings } from "@/features/admin/hooks/use-admin-card-mutations";
import {
  CatalogSourceUploadDialog,
  UploadFormatHelp,
} from "@/features/catalog-admin/components/catalog-source-upload";
import { CatalogSourcesTable } from "@/features/catalog-admin/components/catalog-sources-table";
import { useCatalogSources } from "@/features/catalog-admin/hooks/use-catalog-list";
import { downloadJSONText } from "@/features/collections/lib/json-export";
import { errorText } from "@/lib/error-text";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const exportCatalogFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(async ({ context }): Promise<string> => {
    const data = await apiOrpcClient(adminCardQueriesContract, context.cookie).exportCandidates();
    return JSON.stringify(data, null, 2);
  });

const SWITCH_HELP = [
  {
    term: "Show in review",
    description:
      "Off hides the source from Review and from the compare panel on card pages. Its rows stay stored.",
  },
  {
    term: "Trusted",
    description:
      "Trusted values are what bulk accept may apply, and their compare column is tinted first. Review counts every source, trusted or not.",
  },
  {
    term: "Helpers can review",
    description: "Card-review helpers see this source and can settle it.",
  },
  {
    term: "Order",
    description: "Drag rows to set the column order in compare panels.",
  },
];

function ExportCatalogButton() {
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState("");

  async function handleExport() {
    setExporting(true);
    setFailure("");
    try {
      const json = await exportCatalogFn();
      downloadJSONText(json, `cards-export-${formatDay(new Date())}.json`);
    } catch (error) {
      setFailure(errorText(error, "Export failed"));
    }
    setExporting(false);
  }

  return (
    <>
      <PageTopBarButton disabled={exporting} onClick={() => void handleExport()}>
        {exporting ? <LoaderIcon className="animate-spin" /> : <DownloadIcon />}
        Export catalog
      </PageTopBarButton>
      {failure && <span className="text-destructive text-sm">{failure}</span>}
    </>
  );
}

function RelinkButton() {
  const relink = useRelinkCandidatePrintings();

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" disabled={relink.isPending} onClick={() => relink.mutate()}>
        {relink.isPending ? <LoaderIcon className="animate-spin" /> : <Link2Icon />}
        Relink sources
      </Button>
      {relink.isSuccess && (
        <span className="text-muted-foreground text-sm">
          Linked {relink.data.linked} of {relink.data.examined} stranded rows.
        </span>
      )}
      {relink.isError && (
        <span className="text-destructive flex items-center gap-1 text-sm">
          <XIcon className="size-4" />
          {relink.error.message}
        </span>
      )}
    </div>
  );
}

export function CatalogSourcesPage() {
  const { data, isLoading } = useCatalogSources();
  const { data: isAdmin } = useIsAdmin();
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const sources = data?.sources ?? [];
  const canEdit = isAdmin === true;
  const ignoredTotal = sources.reduce((total, source) => total + source.ignoredCount, 0);
  const names = sources
    .filter((source) => source.kind !== "contributors")
    .map((source) => source.provider);

  return (
    <>
      <AdminPageTopBar
        title="Sources"
        actions={
          canEdit ? (
            <>
              <ExportCatalogButton />
              <PageTopBarButton render={<Link to="/admin/ignored-sources" />}>
                <BanIcon />
                Ignored {ignoredTotal}
              </PageTopBarButton>
              <PageTopBarPrimaryButton onClick={() => setUploadFor("")}>
                <UploadIcon />
                Upload source
              </PageTopBarPrimaryButton>
            </>
          ) : undefined
        }
      />

      <div className="space-y-4 pt-3">
        <p className="text-muted-foreground text-sm">Where card data comes from.</p>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <CatalogSourcesTable
            sources={sources}
            canEdit={canEdit}
            onUploadAgain={(provider) => setUploadFor(provider)}
          />
        )}

        <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {SWITCH_HELP.map((entry) => (
            <div key={entry.term} className="contents">
              <dt className="font-medium">{entry.term}</dt>
              <dd className="text-muted-foreground">{entry.description}</dd>
            </div>
          ))}
        </dl>

        {canEdit && (
          <div className="space-y-3">
            <RelinkButton />
            <UploadFormatHelp />
          </div>
        )}
      </div>

      {uploadFor !== null && (
        <CatalogSourceUploadDialog
          key={uploadFor}
          names={names}
          initialName={uploadFor}
          onClose={() => setUploadFor(null)}
        />
      )}
    </>
  );
}
