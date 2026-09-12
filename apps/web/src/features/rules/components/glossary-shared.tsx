import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import type { PageTocItem } from "@/components/layout/page-toc";
import { Card } from "@/components/ui/card";
import { OrnamentRule } from "@/components/ui/ornament";
import { RowListItem } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import type { Section } from "@/features/rules/lib/glossary-content";
import { glossaryGroups } from "@/features/rules/lib/glossary-content";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function RuleRef({ ruleNumber, className }: { ruleNumber: string; className?: string }) {
  return (
    <TextLink
      className={cn("text-xs", className)}
      render={<Link to="/rules/$kind" params={{ kind: "core" }} hash={`rule-${ruleNumber}`} />}
    >
      {m.glossary_rule_ref({ number: ruleNumber })}
    </TextLink>
  );
}

export function GroupHeading({ id, title }: { id: string; title: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      <OrnamentRule fade="tips">
        <SectionHeading>{title}</SectionHeading>
      </OrnamentRule>
    </div>
  );
}

export function GlossarySectionHeading({ id, title }: Section) {
  return (
    <Heading level={2} as="h3" id={id} className="scroll-mt-20">
      {title}
    </Heading>
  );
}

export function GlossaryTermTile({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li id={id} className="scroll-mt-20">
      <Card size="sm" className={cn("h-full gap-1 px-3", className)}>
        {children}
      </Card>
    </li>
  );
}

export function GlossaryTermRow({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <RowListItem className="flex-col items-start gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="flex items-center gap-2 font-medium sm:w-36 sm:shrink-0">{term}</span>
      {children}
    </RowListItem>
  );
}

export function glossaryTocItems(): PageTocItem[] {
  return glossaryGroups().flatMap((group) => [
    { id: group.id, label: group.title },
    ...group.sections.map((section) => ({
      id: section.id,
      label: section.title,
      level: 1 as const,
    })),
  ]);
}
