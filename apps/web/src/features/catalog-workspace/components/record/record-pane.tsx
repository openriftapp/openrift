import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { LanguageChip } from "@/components/language-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
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
    <section className="flex min-w-0 flex-col gap-3.5">
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
        {subtitle !== undefined && <div className="text-muted-foreground text-sm">{subtitle}</div>}
      </div>
      {badges}
      <span className="flex-1" />
      {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PublicPageLink({
  cardSlug,
  printingSlug,
}: {
  cardSlug: string;
  printingSlug?: string;
}) {
  return (
    <Link
      to="/cards/$cardSlug/{-$printingSlug}"
      params={{ cardSlug, printingSlug }}
      target="_blank"
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      Public page
      <ExternalLinkIcon />
    </Link>
  );
}

export function VariantFacts({
  code,
  language,
  finish,
  rarity,
  extras = [],
}: {
  code: string;
  language: string;
  finish: string;
  rarity?: string;
  extras?: readonly string[];
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {rarity !== undefined && <RarityIcon rarity={rarity} labelled />}
      <span className="font-mono">{code}</span>
      <LanguageChip code={language} />
      <span>{finish}</span>
      {extras.length > 0 && <span>· {extras.join(" · ")}</span>}
    </span>
  );
}

export function CompareSourcesToggle({
  comparing,
  onToggle,
  disabledReason,
}: {
  comparing: boolean;
  onToggle: () => void;
  disabledReason?: string;
}) {
  return (
    <span title={disabledReason}>
      <Button
        variant="link"
        size="xs"
        disabled={disabledReason !== undefined}
        aria-description={disabledReason}
        onClick={onToggle}
      >
        {comparing ? "Close compare" : "Compare sources"}
      </Button>
    </span>
  );
}

export function RecordBanner({ children }: { children: ReactNode }) {
  return <div className="bg-muted rounded-lg px-3 py-2 text-sm">{children}</div>;
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
