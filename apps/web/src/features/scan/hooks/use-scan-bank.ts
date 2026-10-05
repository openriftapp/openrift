import type { CardLabels } from "@openrift/shared/scan/labels";
import { useEffect, useState } from "react";

import type { ScanServing } from "@/features/scan/hooks/use-scan-serving";
import { useScanServing } from "@/features/scan/hooks/use-scan-serving";
import { loadScanLabels } from "@/features/scan/lib/scan-bank";
import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

interface ScanBank {
  assets: ScanServing["assets"];
  labels: CardLabels | null;
  unavailableMessage: string | null;
}

export function useScanBank(): ScanBank {
  const [loaded, setLoaded] = useState<{ url: string; labels: CardLabels } | null>(null);
  const [failed, setFailed] = useState<{ url: string; message: string } | null>(null);

  const serving = useScanServing();
  const assets = serving.assets;
  // assets is re-derived every render; depending on it directly would cancel the in-flight load.
  const labelsUrl = assets?.labelsUrl ?? null;
  useEffect(() => {
    if (labelsUrl === null) {
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const result = await loadScanLabels(labelsUrl as string);
        if (!cancelled) {
          setLoaded({ url: labelsUrl as string, labels: result });
        }
      } catch (error) {
        if (!cancelled) {
          setFailed({
            url: labelsUrl as string,
            message: errorText(error, m.scan_bank_load_failed()),
          });
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [labelsUrl]);

  // Labels from an earlier manifest would pair with the wrong bank.
  const labels = loaded?.url === labelsUrl ? loaded.labels : null;
  const loadError = failed?.url === labelsUrl ? failed.message : null;
  const unavailableMessage = serving.status === "unavailable" ? m.scan_unavailable() : loadError;

  return { assets, labels, unavailableMessage };
}
