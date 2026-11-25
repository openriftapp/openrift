import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-value-labels";

export interface ExistingPrinting {
  key: string;
  printingId: string;
  code: string;
  language: string;
  finish: string;
  size: string;
  markerSlugs: readonly string[];
  distributionChannelSlugs: readonly string[];
  handleCopy?: () => void;
}

export function ExistingPrintingsSection({
  title,
  printings,
}: {
  title: ReactNode;
  printings: readonly ExistingPrinting[];
}) {
  const labels = useValueLabels();

  return (
    <RecordSection title={title}>
      {printings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No printings yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {printings.map((printing) => (
            <li key={printing.key} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId: printing.printingId }}
                className="font-mono underline"
              >
                {printing.code}
              </Link>
              <span className="text-muted-foreground flex-1">
                {[
                  printing.language,
                  formatCatalogFieldValue("finish", printing.finish, labels),
                  formatCatalogFieldValue("size", printing.size, labels),
                  printing.markerSlugs.length > 0
                    ? formatCatalogFieldValue("markerSlugs", printing.markerSlugs, labels)
                    : null,
                  printing.distributionChannelSlugs.length > 0
                    ? formatCatalogFieldValue(
                        "distributionChannelSlugs",
                        printing.distributionChannelSlugs,
                        labels,
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {printing.handleCopy !== undefined && (
                <Button variant="outline" size="sm" onClick={printing.handleCopy}>
                  Copy
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  );
}
