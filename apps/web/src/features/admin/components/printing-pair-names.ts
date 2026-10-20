import { createContext, use } from "react";

const EMPTY: ReadonlyMap<string, string> = new Map();

export const PrintingPairNamesContext = createContext<ReadonlyMap<string, string>>(EMPTY);

export function usePrintingPairNames(): ReadonlyMap<string, string> {
  return use(PrintingPairNamesContext);
}
