import { GripVerticalIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function DragGrip() {
  return <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" />;
}

export function DragChip({
  overlay,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { overlay?: boolean }) {
  return (
    <span
      {...props}
      className={cn(
        "bg-background flex items-center gap-1.5 rounded-md border px-2 py-1",
        overlay && "shadow-lg",
        className,
      )}
    >
      <DragGrip />
      {children}
    </span>
  );
}
