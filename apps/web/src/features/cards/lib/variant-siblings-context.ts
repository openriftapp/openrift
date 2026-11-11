import type { VariantSiblingSummary } from "@openrift/shared/printing-label";
import { createContext } from "react";

export const VariantSiblingsContext = createContext<Record<string, VariantSiblingSummary> | null>(
  null,
);
