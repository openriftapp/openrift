import type { FormatSetWindow } from "@openrift/shared/format-legality";

export function toFormatSetWindow(row: {
  formatId: string;
  setSlug: string;
  circuit: string | null;
  legalFrom: string | null;
  legalUntil: string | null;
}): FormatSetWindow {
  return {
    formatId: row.formatId,
    setSlug: row.setSlug,
    ...(row.circuit === null ? {} : { circuit: row.circuit }),
    legalFrom: row.legalFrom,
    ...(row.legalUntil === null ? {} : { legalUntil: row.legalUntil }),
  };
}
