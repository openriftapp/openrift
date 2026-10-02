import { formatRuleNumber, isRuleLanguage } from "@openrift/shared/rules";
import type { HastNode } from "@openrift/shared/rules-markdown";
import type { RuleLanguage } from "@openrift/shared/types/api/rules";
import { Link } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { diffRuleMarkdown } from "@/features/rules/lib/rules-markdown";
import { useRulesSearchStore } from "@/features/rules/stores/rules-search-store";
import { copyTextToClipboard } from "@/hooks/use-copy-to-clipboard";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export { formatRuleNumber } from "@openrift/shared/rules";

export async function copyRuleLink(ruleNumber: string): Promise<void> {
  const lang = new URLSearchParams(globalThis.location.search).get("lang");
  const search = lang === null ? "" : `?lang=${encodeURIComponent(lang)}`;
  const url = `${globalThis.location.origin}${globalThis.location.pathname}${search}#rule-${ruleNumber}`;
  try {
    await copyTextToClipboard(url);
    toast.success(m.rules_copy_link_success({ rule: formatRuleNumber(ruleNumber) }));
  } catch {
    toast.error(m.rules_copy_link_error());
  }
}

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

function handleSamePageAnchorClick(event: MouseEvent<Element>, href: string): void {
  if (event.defaultPrevented || event.button !== 0) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  const targetId = href.slice(1);
  if (!targetId) {
    return;
  }
  // Rule IDs contain dots (e.g. `rule-540.4.b`); escape so CSS doesn't read
  // them as class separators.
  const targetSelector = `#${CSS.escape(targetId)}`;
  if (document.querySelector(targetSelector)) {
    return;
  }
  // The rule is filtered out by an active search: reset it, then scroll and
  // pushState (not replaceState) so browser back returns to where we were.
  event.preventDefault();
  flushSync(() => {
    useRulesSearchStore.getState().reset();
  });
  const target = document.querySelector(targetSelector);
  if (target instanceof HTMLElement) {
    target.scrollIntoView({ block: "start" });
    history.pushState(null, "", href);
  }
}

export function handleRuleHtmlClick(
  event: MouseEvent<HTMLElement>,
  navigate: (href: string) => void,
): void {
  if (!(event.target instanceof Element)) {
    return;
  }
  const anchor = event.target.closest("a[href]");
  if (anchor === null || anchor.closest(".rule-html") === null) {
    return;
  }
  const href = anchor.getAttribute("href") ?? "";
  if (href.startsWith("#")) {
    handleSamePageAnchorClick(event, href);
    return;
  }
  if (!href.startsWith("/") || event.defaultPrevented || event.button !== 0) {
    return;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return;
  }
  event.preventDefault();
  navigate(href);
}

const CORE_RULE_HREF_REGEX = /^\/rules\/core(?:\?lang=(?<lang>[A-Za-z-]+))?#(?<hash>.+)$/u;

function RuleMarkdownAnchor({ href, children }: { href?: string; children?: ReactNode }) {
  if (typeof href === "string" && href.startsWith("#")) {
    return (
      <TextLink href={href} onClick={(event) => handleSamePageAnchorClick(event, href)}>
        {children}
      </TextLink>
    );
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
    return (
      <span
        className={cn("rounded-md px-1.5 py-0.5 text-sm font-semibold", PENALTY_STYLES[penalty])}
      >
        {children}
      </span>
    );
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
  return (
    <Callout className="mb-4">
      <div
        className="rule-comments"
        // oxlint-disable-next-line react/no-danger -- server-rendered through the allowlist serializer in @openrift/shared/rules-html
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Callout>
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
}: {
  oldText: string;
  newText: string;
  language?: RuleLanguage;
}) {
  const nodes = diffRuleMarkdown(oldText, newText, language);
  return <>{nodes.map((node, index) => renderDiffNode(node, index))}</>;
}
