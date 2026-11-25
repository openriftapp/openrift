import type { ReactNode } from "react";

import { RouteErrorFallback } from "@/components/error-message";
import { errorStatus } from "@/lib/server-fns/api-error";

export function RecordError({
  error,
  missing,
  onRetry,
}: {
  error: unknown;
  missing: ReactNode;
  onRetry: () => void;
}) {
  return errorStatus(error) === 404 ? (
    <p role="alert" className="text-muted-foreground p-4">
      {missing}
    </p>
  ) : (
    <RouteErrorFallback error={error} onRetry={onRetry} />
  );
}
