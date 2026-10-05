import type { ComponentType, ReactNode, SVGProps } from "react";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { IconChip } from "@/components/ui/icon-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

/**
 * A titled panel that starts closed unless `defaultOpen`. Its content still
 * mounts eagerly, so a child that fetches takes `onOpenChange` and gates its own query on it.
 */
export function Disclosure({
  title,
  variant = "boxed",
  defaultOpen = false,
  icon,
  count,
  headingLevel = "h3",
  className,
  contentClassName,
  onOpenChange,
  children,
}: {
  title: ReactNode;
  variant?: "boxed" | "plain" | "heading";
  defaultOpen?: boolean;
  /** `heading` only: a leading icon chip inside the trigger. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** `heading` only: a muted count after the title. */
  count?: number;
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
  contentClassName?: string;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  if (variant === "heading") {
    return (
      <Collapsible
        open={open}
        onOpenChange={handleOpenChange}
        className={cn("flex flex-col gap-3", className)}
      >
        <SectionHeading as={headingLevel}>
          <CollapsibleTrigger
            render={
              <ExpandToggle
                expanded={open}
                chevronPosition="end"
                className="hover:text-foreground w-full gap-2.5 uppercase transition-colors"
              />
            }
          >
            {icon === undefined ? null : <IconChip icon={icon} size="sm" />}
            {title}
            {count === undefined ? null : (
              <span className="text-muted-foreground/60 tabular-nums">{count}</span>
            )}
          </CollapsibleTrigger>
        </SectionHeading>
        <CollapsibleContent className={contentClassName}>{children}</CollapsibleContent>
      </Collapsible>
    );
  }

  const boxed = variant === "boxed";
  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className={cn(boxed && "rounded-md border", className)}
    >
      <CollapsibleTrigger
        render={
          <ExpandToggle
            expanded={open}
            chevronPosition={boxed ? "end" : "start"}
            className={cn(
              "text-muted-foreground hover:text-foreground text-sm font-medium select-none",
              boxed ? "w-full justify-between px-3 py-2" : "gap-1",
            )}
          />
        }
      >
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(boxed ? "px-3 pt-2 pb-3 text-sm" : "pt-2", contentClassName)}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
