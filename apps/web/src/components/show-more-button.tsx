import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

type ShowMoreLabel =
  | { count: number; expanded?: boolean; children?: never }
  | { children: ReactNode; count?: never; expanded?: never };

type ShowMoreButtonProps = ShowMoreLabel & {
  placement?: "below" | "heading";
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
};

function showMoreLabel(props: ShowMoreLabel): ReactNode {
  if (props.count === undefined) {
    return props.children;
  }
  return props.expanded ? m.common_show_fewer() : m.common_show_all({ count: props.count });
}

/** Without `children` the label is "Show all {count}", or "Show fewer" once `expanded`. */
export function ShowMoreButton({
  placement = "below",
  pending = false,
  disabled,
  onClick,
  className,
  ...labelProps
}: ShowMoreButtonProps) {
  const label = showMoreLabel(labelProps);

  if (placement === "heading") {
    return (
      <Button
        variant="link"
        pending={pending}
        disabled={disabled}
        className={cn("h-auto p-0 text-sm font-medium", className)}
        onClick={onClick}
      >
        {label}
      </Button>
    );
  }
  return (
    <div className={cn("mt-4 flex justify-center", className)}>
      <Button variant="ghost" size="sm" pending={pending} disabled={disabled} onClick={onClick}>
        {label}
      </Button>
    </div>
  );
}
