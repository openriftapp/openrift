import { Children } from "react";
import type { ReactNode } from "react";

import {
  SectionHeader,
  SectionHeaderActions,
  SectionHeaderDescription,
  SectionHeaderGroup,
  SectionHeaderTitle,
} from "@/components/section-header";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Trailing control on the title row (a reset button, a status badge). */
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      data-slot="settings-section"
      className={cn("flex scroll-mt-16 flex-col gap-6", className)}
    >
      <SectionHeader>
        <SectionHeaderGroup>
          <SectionHeaderTitle level={3} className="font-heading leading-snug">
            {title}
          </SectionHeaderTitle>
          {description ? <SectionHeaderDescription>{description}</SectionHeaderDescription> : null}
        </SectionHeaderGroup>
        {action ? <SectionHeaderActions>{action}</SectionHeaderActions> : null}
      </SectionHeader>
      {Children.toArray(children).length > 0 ? (
        <div
          data-slot="settings-section-content"
          className={cn("flex flex-col gap-4", contentClassName)}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
