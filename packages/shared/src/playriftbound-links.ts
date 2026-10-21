import type { PlayriftboundFormat } from "./types/enums.js";

export function playriftboundEventUrl(tournamentId: string): string {
  return `https://playriftbound.com/en-US/events/${tournamentId}`;
}

const FORMAT_LABELS: Record<PlayriftboundFormat, string> = {
  CONSTRUCTED: "Constructed",
  LIMITED_SEALED: "Sealed",
  LIMITED_DRAFT: "Draft",
};

export function playriftboundFormatLabel(format: string | null): string | null {
  if (format === null) {
    return null;
  }
  return FORMAT_LABELS[format as PlayriftboundFormat] ?? format;
}
