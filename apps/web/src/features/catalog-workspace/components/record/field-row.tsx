import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function FieldRow({
  label,
  value,
  onEdit,
  editing,
  suggestions,
}: {
  label: ReactNode;
  value: ReactNode;
  onEdit?: () => void;
  editing?: ReactNode;
  suggestions?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 border-t py-1.5 first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words">{editing ?? value}</div>
      <div>
        {onEdit !== undefined && editing === undefined && (
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
      {suggestions !== undefined && (
        <div className="col-span-2 col-start-2 flex flex-col gap-1.5">{suggestions}</div>
      )}
    </div>
  );
}
