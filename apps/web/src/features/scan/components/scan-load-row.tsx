import { CheckIcon, XIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import type { ResourceProgress } from "@/features/scan/lib/scan-load-progress";
import { m } from "@/paraglide/messages.js";

function formatMb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

interface ScanLoadRowProps {
  label: string;
  done: boolean;
  failed?: boolean;
  progress?: ResourceProgress;
}

export function ScanLoadRow({ label, done, failed = false, progress }: ScanLoadRowProps) {
  let detail: string | null = null;
  let percent: number | null = null;
  if (!done && !failed && progress) {
    if (progress.total > 0 && progress.loaded >= progress.total) {
      // Fully downloaded but not ready yet: wasm compilation or session setup.
      detail = m.scan_load_row_starting();
      percent = 100;
    } else if (progress.total > 0) {
      detail = `${formatMb(progress.loaded)} / ${formatMb(progress.total)}`;
      percent = (100 * progress.loaded) / progress.total;
    } else if (progress.loaded > 0) {
      detail = formatMb(progress.loaded);
    }
  }
  return (
    <div className="w-64 max-w-full">
      <div className="flex items-center gap-2">
        {done && <CheckIcon className="text-success size-4 shrink-0" />}
        {!done && failed && <XIcon className="text-destructive size-4 shrink-0" />}
        {!done && !failed && <Spinner aria-hidden="true" className="shrink-0" />}
        {/* Colours are inherited, not pinned: these rows also run on the dark
            plate of the pre-start panel where text-foreground would be invisible. */}
        <span className="flex-1 text-left">{label}</span>
        {detail !== null && <span className="text-sm tabular-nums opacity-70">{detail}</span>}
      </div>
      {percent !== null && <Progress value={percent} className="mt-1.5" />}
    </div>
  );
}
