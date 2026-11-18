import type { ReactNode } from "react";

import { OrnamentRule } from "@/components/ui/ornament";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-16 space-y-6", className)}
    >
      <OrnamentRule fade="tips">
        <SectionHeading id={`${id}-heading`}>{title}</SectionHeading>
      </OrnamentRule>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}
