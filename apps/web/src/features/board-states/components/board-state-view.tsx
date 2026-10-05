import { extractRuleRefs } from "@openrift/shared/board-state";
import type { PublicBoardStateResponse } from "@openrift/shared/types/api/board-state";
import { useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { RuleChip, RulesPinBadges } from "@/features/board-states/components/board-caption-text";
import { BoardStepsPlayer } from "@/features/board-states/components/board-steps-player";
import { useKnownRules } from "@/features/rules/hooks/use-known-rules";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function BoardStateView({
  boardState,
  ownerName,
  actions,
}: {
  boardState: PublicBoardStateResponse;
  ownerName: string;
  actions?: React.ReactNode;
}) {
  const [activeStep, setActiveStep] = useState(0);
  const knownRules = useKnownRules(boardState);
  const { document } = boardState;
  const ruleRefs = extractRuleRefs(document.steps.map((s) => s.caption).join("\n"));

  return (
    <>
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarTitle>{boardState.title}</PageTopBarTitle>
          {actions ? <PageTopBarActions>{actions}</PageTopBarActions> : null}
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP, "flex flex-col gap-4 pt-3 pb-8")}>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <RulesPinBadges pins={boardState} />
          {boardState.isFeatured ? null : (
            <Badge variant="outline">{m.board_states_not_reviewed()}</Badge>
          )}
          <span>{m.board_states_byline({ owner: ownerName })}</span>
        </div>

        <BoardStepsPlayer
          document={document}
          pins={boardState}
          activeStep={activeStep}
          onStep={setActiveStep}
          extra={
            ruleRefs.length > 0 ? (
              <div className="flex flex-col gap-2">
                <SectionHeading>{m.board_states_rules_used()}</SectionHeading>
                <div className="flex flex-wrap gap-2">
                  {ruleRefs.map((reference) => (
                    <RuleChip
                      key={`${reference.kind}:${reference.ruleNumber}`}
                      reference={reference}
                      pins={boardState}
                      knownRules={knownRules}
                    />
                  ))}
                </div>
              </div>
            ) : undefined
          }
        />
      </div>
    </>
  );
}
