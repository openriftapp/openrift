import { Children } from "react";
import type { ReactNode } from "react";

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
      className={cn("flex scroll-mt-16 flex-col gap-4", className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-base leading-snug font-medium">{title}</h3>
          {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {action}
      </div>
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
