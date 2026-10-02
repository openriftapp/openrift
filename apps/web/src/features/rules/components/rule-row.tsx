import { ruleNumberDepth } from "@openrift/shared/rules";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RuleExamplesList, RuleExamplesMarker } from "@/features/rules/components/rule-examples";
import { ruleHtmlToText } from "@/features/rules/lib/rule-text";
import type { ChangeKind, RuleEntry } from "@/features/rules/lib/rules-changes";
import { changeKindBadge } from "@/features/rules/lib/rules-changes";
import { useRulesFoldStore } from "@/features/rules/stores/rules-fold-store";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { copyRuleLink, formatRuleNumber, InlineDiff } from "./rule-content";

const GUIDE_DEPTH_CLASS: Record<number, string> = {
  1: "rule-guides [--rule-depth:1]",
  2: "rule-guides [--rule-depth:2]",
  3: "rule-guides [--rule-depth:3]",
};

export function RuleRow({
  rule,
  ancestors,
  hasChildren,
  isContext,
  changeKind,
  previousContent,
  relatedRuleNumber,
  changesView,
  previousVersionLabel,
  versionLabel,
}: {
  rule: RuleEntry;
  ancestors: readonly string[];
  hasChildren: boolean;
  isContext?: boolean;
  changeKind?: ChangeKind;
  previousContent?: string;
  relatedRuleNumber?: string;
  changesView?: "inline" | "side";
  previousVersionLabel?: string;
  versionLabel?: string;
}) {
  // Fold state is subscribed per-row, not by the parent, so its `.map()`
  // result stays cached across fold toggles.
  const isFolded = useRulesFoldStore((state) => state.foldedRules.has(rule.ruleNumber));
  const isHidden = useRulesFoldStore((state) =>
    ancestors.some((ancestor) => state.foldedRules.has(ancestor)),
  );
  const toggle = useRulesFoldStore((state) => state.toggle);

  const isTitle = rule.ruleType === "title";
  const isSubtitle = rule.ruleType === "subtitle";
  const isRemoved = changeKind === "removed";
  const isChanged = changeKind === "changed";
  const badge = changeKind ? changeKindBadge(changeKind) : null;
  const diff =
    isChanged &&
    changesView !== undefined &&
    previousContent !== undefined &&
    rule.content !== undefined
      ? { oldText: previousContent, newText: rule.content }
      : null;

  return (
    <div className={cn(isHidden && "hidden")}>
      <div
        id={`rule-${rule.ruleNumber}`}
        className={cn(
          "group/rule relative flex scroll-mt-(--rules-anchor-offset) items-baseline py-2 text-sm",
          GUIDE_DEPTH_CLASS[ruleNumberDepth(rule.ruleNumber)],
          isTitle && "border-border mt-6 border-b first:mt-0",
          isSubtitle && "mt-4",
          isContext && "opacity-60",
          isRemoved && "line-through decoration-from-font opacity-60",
        )}
      >
        <Pressable
          onClick={() => {
            void copyRuleLink(rule.ruleNumber);
          }}
          aria-label={m.rules_copy_link_aria({ rule: formatRuleNumber(rule.ruleNumber) })}
          className={cn(
            // Copy glyph is a ::after mask via rule-copy-affordance, not a <CopyIcon>
            // element, since this page renders ~2,400 of them. See index.css.
            "rule-copy-affordance text-muted-foreground hover:text-foreground mr-3 flex shrink-0 items-start gap-1 font-mono text-xs no-underline",
            isTitle && "font-semibold",
          )}
        >
          <span>{formatRuleNumber(rule.ruleNumber)}</span>
        </Pressable>
        <div
          className={cn(
            "min-w-0 flex-1",
            isTitle && "text-base font-bold",
            isSubtitle && "font-semibold",
          )}
        >
          {diff && changesView === "side" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <DiffPane title={previousVersionLabel} tone="old">
                <InlineDiff {...diff} language={rule.language} side="old" />
              </DiffPane>
              <DiffPane title={versionLabel} tone="new">
                <InlineDiff {...diff} language={rule.language} side="new" />
              </DiffPane>
            </div>
          ) : diff ? (
            <InlineDiff {...diff} language={rule.language} />
          ) : isTitle || isSubtitle ? (
            ruleHtmlToText(rule.contentHtml)
          ) : (
            <div
              className="rule-html"
              // oxlint-disable-next-line react/no-danger -- server-rendered through the allowlist serializer in @openrift/shared/rules-html
              dangerouslySetInnerHTML={{ __html: rule.contentHtml }}
            />
          )}
          {!isTitle && !isSubtitle && <RuleExamplesMarker ruleNumber={rule.ruleNumber} />}
        </div>
        {badge ? (
          (changeKind === "moved" || changeKind === "replaced") &&
          relatedRuleNumber !== undefined ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Badge
                      className={cn("ml-3 shrink-0 cursor-help no-underline", badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  }
                />
                <TooltipContent>
                  {changeKind === "moved"
                    ? m.rules_moved_from({ rule: formatRuleNumber(relatedRuleNumber) })
                    : m.rules_moved_to({ rule: formatRuleNumber(relatedRuleNumber) })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <Badge className={cn("ml-3 shrink-0 no-underline", badge.className)}>
              {badge.label}
            </Badge>
          )
        ) : null}
        {hasChildren ? (
          <span
            className={cn(
              "ml-3 flex size-4 shrink-0 self-start sm:absolute sm:-right-5 sm:mt-0 sm:ml-0",
              isTitle ? "mt-1 sm:top-3" : "mt-0.5 sm:top-2.5",
              !isFolded &&
                "transition-opacity sm:pointer-fine:opacity-0 sm:pointer-fine:group-hover/rule:opacity-100 sm:pointer-fine:focus-within:opacity-100",
            )}
          >
            <ExpandToggle
              expanded={!isFolded}
              onClick={() => toggle(rule.ruleNumber)}
              aria-label={isFolded ? m.rules_expand_group() : m.rules_collapse_group()}
              className="text-muted-foreground hover:text-foreground size-4 justify-center gap-0 rounded-md no-underline"
              chevronClassName="size-3 text-inherit"
            />
          </span>
        ) : null}
      </div>
      {!isTitle && !isSubtitle && <RuleExamplesList ruleNumber={rule.ruleNumber} />}
    </div>
  );
}

function DiffPane({
  title,
  tone,
  children,
}: {
  title?: string;
  tone: "old" | "new";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg px-3 py-2",
        tone === "old" ? "bg-muted/60" : "bg-card ring-success/40 ring-1",
      )}
    >
      {title && (
        <p
          className={cn(
            "text-xs font-semibold tracking-wide uppercase",
            tone === "old" ? "text-muted-foreground" : "text-success",
          )}
        >
          {title}
        </p>
      )}
      <div>{children}</div>
    </div>
  );
}
