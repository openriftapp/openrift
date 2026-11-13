import { XIcon } from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function NudgeCallout({
  icon: Icon,
  title,
  body,
  action,
  onDismiss,
  dismissLabel,
  className,
  children,
}: {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  onDismiss: () => void;
  dismissLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Callout
      data-slot="nudge-callout"
      className={cn("flex items-start justify-between gap-4", className)}
    >
      {Icon ? <Icon className="text-primary mt-0.5 size-4 shrink-0" /> : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-medium">{title}</span>
          {body ? <> {body}</> : null}
        </p>
        {children ? <div className="text-muted-foreground text-sm">{children}</div> : null}
      </div>
      <div className="-my-1 flex shrink-0 items-center gap-1">
        {action}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          aria-label={dismissLabel ?? m.common_dismiss()}
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </Callout>
  );
}
