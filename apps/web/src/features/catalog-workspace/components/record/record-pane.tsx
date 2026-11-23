import { countNoun, pluralize } from "@openrift/shared/strings";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Card } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { TextLink } from "@/components/ui/text-link";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { cn } from "@/lib/utils";

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

/** A message in place of a record; registers as ready with no actions. */
export function RecordNotice({ children }: { children: ReactNode }) {
  useRegisterRecordActions({});
  return <p className="text-muted-foreground p-4">{children}</p>;
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

export function PendingReviewNotice({
  record,
  cards,
}: {
  record: "printing" | "face";
  cards: readonly { cardSlug: string; cardName: string; pending: number }[];
}) {
  const count = cards.reduce((sum, card) => sum + card.pending, 0);
  if (count === 0) {
    return null;
  }
  return (
    <RecordBanner>
      {`${countNoun(count, "suggestion")} ${pluralize(count, "is", "are")} pending on this ${record}.`}
      {cards.map((card) => (
        <TextLink
          key={card.cardSlug}
          className="ml-2"
          render={
            <Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug: card.cardSlug }} />
          }
        >
          Review {card.cardName}
        </TextLink>
      ))}
    </RecordBanner>
  );
}

export function RecordSection({
  title,
  titleAction,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  summary,
}: {
  title: ReactNode;
  titleAction?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  summary?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const expanded = !collapsible || open;
  const heading = (
    <Heading
      level={3}
      className={cn("font-heading font-semibold", titleAction === undefined && "flex-1")}
    >
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
        {titleAction !== undefined && (
          <span className="flex flex-1 items-center">{expanded && titleAction}</span>
        )}
        {expanded && actions}
      </div>
      {expanded && <div className="min-w-0">{children}</div>}
    </Card>
  );
}
