import type { DeckImportFormat } from "@/features/decks/lib/deck-import-parsers";
import { m } from "@/paraglide/messages.js";

export type DeckImportMode = "auto" | DeckImportFormat;

export function importModeLabels(): Record<DeckImportMode, string> {
  return {
    auto: m.decks_import_mode_auto(),
    text: m.decks_import_mode_text(),
    piltover: m.decks_import_mode_piltover(),
    tts: m.decks_import_mode_tts(),
  };
}

export const IMPORT_MODE_ORDER: DeckImportMode[] = ["auto", "text", "piltover", "tts"];

export function detectedFormatLabels(): Record<DeckImportFormat, string> {
  return {
    piltover: m.decks_import_detected_piltover(),
    text: m.decks_import_detected_text(),
    tts: m.decks_import_detected_tts(),
  };
}

export function importPlaceholders(): Record<DeckImportMode, string> {
  return {
    auto: m.decks_import_placeholder_auto(),
    piltover: m.decks_import_placeholder_piltover(),
    text: "Legend:\n1 Card Name\n\nMainDeck:\n3 Card Name\n...",
    tts: "OGN-001-1 OGN-002-1 OGN-003-1 ...",
  };
}
