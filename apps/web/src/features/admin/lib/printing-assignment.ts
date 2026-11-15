import type { AdminMarketplaceName } from "@openrift/shared/types/api/admin";

export interface PrintingAssignment {
  externalId: number;
  finish: string;
  language: string | null;
  printingId: string;
}

export function emptyAssignmentsByMarketplace(): Record<
  AdminMarketplaceName,
  PrintingAssignment[]
> {
  return { tcgplayer: [], cardmarket: [], cardtrader: [], cardnexus: [] };
}
