import type { ReactNode } from "react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Card } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";

export function RecordPane({
  header,
  banner,
  children,
}: {
  header: ReactNode;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3.5 px-4 py-3.5 sm:px-5">
      {header}
      {banner}
      {children}
    </section>
  );
}

export function RecordHeader({
  title,
  subtitle,
  badges,
  actions,
  thumb,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  thumb?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {thumb}
      <div className="min-w-0">
        <Heading level={2}>{title}</Heading>
        {subtitle !== undefined && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
      {badges}
      <span className="flex-1" />
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function RecordBanner({ children }: { children: ReactNode }) {
  return <div className="bg-muted rounded-lg px-3 py-2 text-sm">{children}</div>;
}

export function RecordSection({
  title,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  summary,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !collapsible || open;
  const heading = (
    <Heading level={3} className="font-heading flex-1 font-semibold">
      {title}
    </Heading>
  );

  return (
    <Card className="gap-2 px-4">
      <div className="flex flex-wrap items-center gap-2">
        {collapsible ? (
          <ExpandToggle
            expanded={open}
            chevronPosition="start"
            className="min-w-0 flex-1"
            onClick={() => setOpen((value) => !value)}
          >
            {heading}
            {!open && summary !== undefined && (
              <span className="text-muted-foreground text-sm">{summary}</span>
            )}
          </ExpandToggle>
        ) : (
          heading
        )}
        {expanded && actions}
      </div>
      {expanded && <div className="min-w-0">{children}</div>}
    </Card>
  );
}
