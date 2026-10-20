import { printingLabelParts } from "@openrift/shared/printing-label";
import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import { Fragment } from "react";

import { usePrintingPairNames } from "./printing-pair-names";

const MATCH_CLASS = "underline decoration-2 underline-offset-2";

export function PrintingLabel({
  printing,
  highlightFinish,
  highlightLanguage,
  highlightMarkers,
}: {
  printing: Pick<
    UnifiedMappingPrintingResponse,
    "shortCode" | "markerSlugs" | "finish" | "language" | "size"
  > & { printingId?: string };
  highlightFinish?: string;
  highlightLanguage?: string;
  highlightMarkers?: boolean;
}) {
  const pairName = usePrintingPairNames().get(printing.printingId ?? "");
  const langMatches = highlightLanguage !== undefined && printing.language === highlightLanguage;
  const finishMatches = highlightFinish !== undefined && printing.finish === highlightFinish;
  const parts = printingLabelParts(
    printing.shortCode,
    printing.markerSlugs,
    printing.finish,
    printing.language,
    printing.size,
  );
  const partClasses = [
    ...(printing.language ? [langMatches ? MATCH_CLASS : undefined] : []),
    undefined,
    highlightMarkers ? MATCH_CLASS : undefined,
    finishMatches ? MATCH_CLASS : undefined,
    "text-warning",
  ];
  return (
    <span>
      {pairName !== undefined && <span className="mr-1 font-sans">{pairName}</span>}
      {parts.map((part, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- the parts are positional
        <Fragment key={index}>
          {index > 0 && ":"}
          <span className={partClasses[index]}>{part}</span>
        </Fragment>
      ))}
    </span>
  );
}
