import type { ReactNode } from "react";
import { useState } from "react";

import { ExpandToggle } from "@/components/ui/expand-toggle";
import { OrnamentRule } from "@/components/ui/ornament";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

// `defaultCollapsed` only applies when `collapsible` is set.
export function SettingsGroup({
  id,
  title,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!(collapsible && defaultCollapsed));
  const heading = "text-muted-foreground text-sm font-medium tracking-wide uppercase";
  return (
    <section id={id} className={cn("scroll-mt-16 space-y-6", className)}>
      <OrnamentRule fade="tips">
        {collapsible ? (
          <h2>
            {/* The heading classes sit on the button: the CSS reset puts
              text-transform: none on buttons, so uppercase on the h2 alone
              would not reach the label. */}
            <ExpandToggle
              expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className={heading}
            >
              {title}
            </ExpandToggle>
          </h2>
        ) : (
          <SectionHeading>{title}</SectionHeading>
        )}
      </OrnamentRule>
      {expanded ? <div className="flex flex-col gap-8">{children}</div> : null}
    </section>
  );
}
