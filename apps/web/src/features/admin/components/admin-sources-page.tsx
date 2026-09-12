import { adminCardQueriesContract } from "@openrift/shared/contracts/admin/card-queries";
import { formatDay } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  BanIcon,
  DownloadIcon,
  Link2Icon,
  ListChecksIcon,
  LoaderIcon,
  UploadIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminSourcesTable } from "@/features/admin/components/admin-sources-table";
import { SourceUploadDialog } from "@/features/admin/components/source-upload-dialog";
import {
  useCheckMatchingCandidates,
  useRelinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useSources } from "@/features/admin/hooks/use-sources";
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
    term: "Check matching",
    description:
      "Marks every unchecked source row checked when each value it provides equals the live card or printing. Fields the source leaves empty count as matching. Contributor submissions and unlinked printings are left alone.",
  },
  {
    term: "Order",
    description: "Drag rows to set the column order in compare panels.",
  },
];

function ExportCatalogButton() {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const json = await exportCatalogFn();
      downloadJSONText(json, `cards-export-${formatDay(new Date())}.json`);
    } catch (error) {
      toast.error(errorText(error, "Export failed"));
    }
    setExporting(false);
  }

  return (
    <PageTopBarButton disabled={exporting} onClick={() => void handleExport()}>
      {exporting ? <LoaderIcon className="animate-spin" /> : <DownloadIcon />}
      Export catalog
    </PageTopBarButton>
  );
}

function RelinkSourcesButton() {
  const relink = useRelinkCandidatePrintings();

  return (
    <PageTopBarButton
      disabled={relink.isPending}
      onClick={() =>
        relink.mutate(undefined, {
          onSuccess: (result) => {
            toast.success(`Linked ${result.linked} of ${result.examined} stranded rows`);
          },
          onError: (error) => {
            toast.error(error.message);
          },
        })
      }
    >
      {relink.isPending ? <LoaderIcon className="animate-spin" /> : <Link2Icon />}
      Relink sources
    </PageTopBarButton>
  );
}

function CheckMatchingButton() {
  const checkMatching = useCheckMatchingCandidates();

  return (
    <PageTopBarButton
      disabled={checkMatching.isPending}
      onClick={() =>
        checkMatching.mutate(undefined, {
          onSuccess: (result) => {
            toast.success(
              `Checked ${result.cardsChecked} matching cards and ${result.printingsChecked} matching printings`,
            );
          },
          onError: (error) => {
            toast.error(error.message);
          },
        })
      }
    >
      {checkMatching.isPending ? <LoaderIcon className="animate-spin" /> : <ListChecksIcon />}
      Check matching
    </PageTopBarButton>
  );
}

export function AdminSourcesPage() {
  const { data, isLoading } = useSources();
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const sources = data?.sources ?? [];
  const ignoredTotal = sources.reduce((total, source) => total + source.ignoredCount, 0);
  const names = sources
    .filter((source) => source.kind !== "contributors")
    .map((source) => source.provider);

  return (
    <>
      <AdminPageTopBar
        title="Sources"
        actions={
          <>
            <ExportCatalogButton />
            <RelinkSourcesButton />
            <CheckMatchingButton />
            <PageTopBarButton render={<Link to="/admin/ignored-sources" />}>
              <BanIcon />
              Ignored {ignoredTotal}
            </PageTopBarButton>
            <PageTopBarPrimaryButton onClick={() => setUploadFor("")}>
              <UploadIcon />
              Upload source
            </PageTopBarPrimaryButton>
          </>
        }
      />

      <div className="flex flex-col gap-8">
        {isLoading ? <Skeleton className="h-64 w-full" /> : <AdminSourcesTable sources={sources} />}

        <div className="flex flex-col gap-2">
          <SectionHeading>What the switches do</SectionHeading>
          <DefinitionList className="grid-cols-[9rem_minmax(0,1fr)]">
            {SWITCH_HELP.map((entry) => (
              <div key={entry.term} className="contents">
                <DefinitionTerm className="text-foreground">{entry.term}</DefinitionTerm>
                <DefinitionDetail className="text-muted-foreground">
                  {entry.description}
                </DefinitionDetail>
              </div>
            ))}
          </DefinitionList>
        </div>
      </div>

      {uploadFor !== null && (
        <SourceUploadDialog
          key={uploadFor}
          names={names}
          initialName={uploadFor}
          onClose={() => setUploadFor(null)}
        />
      )}
    </>
  );
}
