import { isRuleLanguage } from "@openrift/shared/rules";
import type { HastNode } from "@openrift/shared/rules-markdown";
import type { RuleLanguage } from "@openrift/shared/types/api/rules";
import { Link } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { MouseEvent, ReactNode } from "react";

import { Callout } from "@/components/ui/callout";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { TextLink } from "@/components/ui/text-link";
import { diffRuleMarkdown, diffRuleSide } from "@/features/rules/lib/rules-markdown-diff";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Tournament penalty labels — matched as literal `[Label]` strings inside rule
// bodies and styled on the status tokens by severity.
const PENALTY_STYLES: Record<string, string> = {
  Warning: "bg-warning-soft text-warning",
  Warnings: "bg-warning-soft text-warning",
  "Game Loss": "bg-warning-soft text-warning",
  "No Penalty": "bg-muted text-muted-foreground",
  "Match Loss": "bg-destructive-soft text-destructive",
  Disqualification: "bg-destructive text-destructive-foreground",
};

export function PenaltyBadge({ penalty, children }: { penalty: string; children: ReactNode }) {
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-sm font-semibold", PENALTY_STYLES[penalty])}>
      {children}
    </span>
  );
}

export interface RuleLinkHandlers {
  navigate: (href: string) => void;
  /** `rendered` is false when an active search filters the target out. */
  jump: (targetId: string, rendered: boolean) => void;
}

function isPlainClick(event: MouseEvent<Element>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function handleRuleHtmlClick(
  event: MouseEvent<HTMLElement>,
  { navigate, jump }: RuleLinkHandlers,
): void {
  if (!(event.target instanceof Element)) {
    return;
  }
  const anchor = event.target.closest("a[href]");
  if (anchor === null || anchor.closest(".rule-html, [data-rule-diff]") === null) {
    return;
  }
  const href = anchor.getAttribute("href") ?? "";
  if (!isPlainClick(event)) {
    return;
  }
  if (href.startsWith("#")) {
    const targetId = href.slice(1);
    if (targetId) {
      event.preventDefault();
      jump(targetId, document.querySelector(`#${CSS.escape(targetId)}`) !== null);
    }
    return;
  }
  if (href.startsWith("/")) {
    event.preventDefault();
    navigate(href);
  }
}

const CORE_RULE_HREF_REGEX = /^\/rules\/core(?:\?lang=(?<lang>[A-Za-z-]+))?#(?<hash>.+)$/u;

function RuleMarkdownAnchor({ href, children }: { href?: string; children?: ReactNode }) {
  if (typeof href === "string" && href.startsWith("#")) {
    return <TextLink href={href}>{children}</TextLink>;
  }
  if (typeof href === "string" && href.startsWith("/cards/")) {
    return (
      <TextLink
        render={
          <Link
            to="/cards/$cardSlug/{-$printingSlug}"
            params={{ cardSlug: href.slice("/cards/".length) }}
          />
        }
      >
        {children}
      </TextLink>
    );
  }
  const coreRule = typeof href === "string" ? CORE_RULE_HREF_REGEX.exec(href)?.groups : undefined;
  if (coreRule?.hash !== undefined) {
    return (
      <TextLink
        render={
          <Link
            to="/rules/$kind"
            params={{ kind: "core" }}
            search={isRuleLanguage(coreRule.lang) ? { lang: coreRule.lang } : {}}
            hash={coreRule.hash}
          />
        }
      >
        {children}
      </TextLink>
    );
  }
  return (
    <TextLink href={href} target="_blank" rel="noreferrer">
      {children}
    </TextLink>
  );
}

function RuleMarkdownSpan({
  penalty,
  diff,
  children,
}: {
  penalty?: string;
  diff?: string;
  children?: ReactNode;
}) {
  if (penalty && PENALTY_STYLES[penalty]) {
    return <PenaltyBadge penalty={penalty}>{children}</PenaltyBadge>;
  }
  if (diff === "added") {
    return <mark className="bg-success-soft text-success rounded-xs px-0.5">{children}</mark>;
  }
  if (diff === "removed") {
    return (
      <span className="bg-destructive/10 text-destructive rounded-xs px-0.5 line-through decoration-from-font">
        {children}
      </span>
    );
  }
  return <span>{children}</span>;
}

export function VersionComments({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <div className="mb-4">
      <ExpandToggle
        expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((open) => !open)}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        {m.rules_version_note()}
      </ExpandToggle>
      {expanded && (
        <Callout id={contentId} className="mt-2">
          <div className="rule-comments" dangerouslySetInnerHTML={{ __html: html }} />
        </Callout>
      )}
    </div>
  );
}

// Renders one node of the merged diff tree produced by `diffRuleMarkdown`.
function renderDiffNode(node: HastNode, key: number): ReactNode {
  if (node.type === "text") {
    return node.value ?? "";
  }
  const children = (node.children ?? []).map((child, index) => renderDiffNode(child, index));
  switch (node.tagName) {
    case "br": {
      return <br key={key} />;
    }
    case "em": {
      return <em key={key}>{children}</em>;
    }
    case "strong": {
      return <strong key={key}>{children}</strong>;
    }
    case "code": {
      return <code key={key}>{children}</code>;
    }
    case "a": {
      const href = node.properties?.href;
      return (
        <RuleMarkdownAnchor key={key} href={typeof href === "string" ? href : undefined}>
          {children}
        </RuleMarkdownAnchor>
      );
    }
    default: {
      const penalty = node.properties?.["data-penalty"];
      const diff = node.properties?.["data-diff"];
      return (
        <RuleMarkdownSpan
          key={key}
          penalty={typeof penalty === "string" ? penalty : undefined}
          diff={typeof diff === "string" ? diff : undefined}
        >
          {children}
        </RuleMarkdownSpan>
      );
    }
  }
}

// Both texts are parsed through the full markdown pipeline and diffed
// structurally, so emphasis, links and penalty badges survive the diff.
export function InlineDiff({
  oldText,
  newText,
  language,
  side,
}: {
  oldText: string;
  newText: string;
  language?: RuleLanguage;
  side?: "old" | "new";
}) {
  const merged = diffRuleMarkdown(oldText, newText, language);
  const nodes = side === undefined ? merged : diffRuleSide(merged, side);
  return <span data-rule-diff>{nodes.map((node, index) => renderDiffNode(node, index))}</span>;
}
