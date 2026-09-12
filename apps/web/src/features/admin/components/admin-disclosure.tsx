import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * A titled panel that starts closed. Its content still mounts eagerly, so a
 * child that fetches takes `onOpenChange` and gates its own query on it.
 */
export function AdminDisclosure({
  title,
  contentClassName,
  onOpenChange,
  children,
}: {
  title: ReactNode;
  contentClassName?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible className="rounded-md border" onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group text-muted-foreground hover:text-foreground flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium select-none">
        {title}
        <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("px-3 pt-2 pb-3 text-sm", contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
