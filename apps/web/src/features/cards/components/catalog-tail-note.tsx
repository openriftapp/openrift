import { Button } from "@/components/ui/button";
import type { CatalogTailStatus } from "@/features/cards/hooks/use-cards";
import { m } from "@/paraglide/messages.js";

/** Pass the result of `useCatalogTailStatus()`; render it only while the status is not complete. */
export function CatalogTailNote({
  status,
  retry,
  loadingText,
  failedText,
  className,
}: {
  status: Exclude<CatalogTailStatus, "complete">;
  retry: () => void;
  loadingText: string;
  failedText: string;
  className?: string;
}) {
  return (
    <p role="status" className={className}>
      {status === "failed" ? (
        <>
          {failedText}{" "}
          <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>
            {m.common_retry()}
          </Button>
        </>
      ) : (
        loadingText
      )}
    </p>
  );
}
