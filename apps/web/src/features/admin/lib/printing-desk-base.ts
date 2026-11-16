import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";

export function basePrintingForLanguage(
  printings: readonly DeskPrintingRow[],
  language: string,
): DeskPrintingRow | undefined {
  return printings.find((printing) => printing.language === language) ?? printings.at(0);
}

interface BaseSeed {
  setId: string;
  finish: string;
  size: string;
}

/** After a language change, each of set, finish and size still at the old base's value follows the new base. */
export function reseedFromBase(
  current: BaseSeed,
  from: DeskPrintingRow | undefined,
  to: DeskPrintingRow | undefined,
): BaseSeed {
  if (from === undefined || to === undefined) {
    return current;
  }
  return {
    setId: current.setId === from.setId ? to.setId : current.setId,
    finish: current.finish === from.finish ? to.finish : current.finish,
    size: current.size === from.size ? to.size : current.size,
  };
}

export function defaultCardLanguage(
  languages: readonly string[],
  preferred: readonly string[],
): string {
  return preferred.find((code) => languages.includes(code)) ?? languages.at(0) ?? "en";
}
