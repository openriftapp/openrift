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
  return (
    <section id={id} className={cn("scroll-mt-16 space-y-6", className)}>
      <OrnamentRule fade="tips">
        {collapsible ? (
          <h2>
            <ExpandToggle expanded={expanded} onClick={() => setExpanded(!expanded)}>
              <SectionHeading as="span">{title}</SectionHeading>
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
