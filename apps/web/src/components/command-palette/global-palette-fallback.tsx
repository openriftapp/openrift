import { SearchIcon, TriangleAlertIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

export function GlobalPaletteFallback() {
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center gap-2 text-sm">
      <SearchIcon className="size-4 animate-pulse" />
      {m.palette_loading_cards()}
    </div>
  );
}

export function GlobalPaletteError() {
  return (
    <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-1 px-6 text-center text-sm">
      <TriangleAlertIcon className="size-4" />
      <span>{m.palette_load_failed()}</span>
      <span className="text-xs">{m.palette_load_failed_hint()}</span>
    </div>
  );
}
