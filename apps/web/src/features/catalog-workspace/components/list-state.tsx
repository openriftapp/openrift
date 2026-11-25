import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";

export function ListState({
  isPending,
  error,
  toolbar,
  children,
}: {
  isPending: boolean;
  error: Error | null;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  if (error === null && !isPending) {
    return children;
  }
  const body =
    error === null ? (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    ) : (
      <p role="alert" className="text-muted-foreground py-6">
        This list could not be loaded. {error.message}
      </p>
    );
  if (toolbar === undefined) {
    return body;
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      {body}
    </div>
  );
}
