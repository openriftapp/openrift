import { Link2OffIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import type { PageWidth } from "@/lib/utils";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";

export function LinkGoneState({
  title,
  description,
  action,
  width = "full",
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  width?: PageWidth;
}) {
  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH[width])}>
      <EmptyState className="py-16" icon={Link2OffIcon} title={title} description={description}>
        {action}
      </EmptyState>
    </div>
  );
}
