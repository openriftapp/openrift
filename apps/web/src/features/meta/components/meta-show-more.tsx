import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function MetaShowMore({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="mt-4 flex justify-center">
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}
