import { extractRuleRefs } from "@openrift/shared/board-state";
import type { PublicBoardStateResponse } from "@openrift/shared/types/api/board-state";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BoardCaptionText,
  RuleChip,
  RulesPinBadges,
} from "@/features/rules/components/board-caption-text";
import { BoardView } from "@/features/rules/components/board-view";
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
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const { document } = boardState;
  const total = document.steps.length;
  const step = document.steps[Math.min(activeStep, total - 1)];
  const ruleRefs = extractRuleRefs(
    [boardState.answer ?? "", ...document.steps.map((s) => s.caption)].join("\n"),
  );

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{boardState.title}</PageTopBarTitle>
          {actions ? <PageTopBarActions>{actions}</PageTopBarActions> : null}
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP, "flex flex-col gap-4 pt-3 pb-8")}>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          <RulesPinBadges pins={boardState} />
          {boardState.isFeatured ? null : (
            <Badge variant="outline">{m.board_states_not_reviewed()}</Badge>
          )}
          <span>{m.board_states_byline({ owner: ownerName })}</span>
        </div>

        {boardState.answer ? (
          <div className="bg-card border-primary flex flex-col gap-1 rounded-md border p-3">
            <span className="text-muted-foreground text-xs uppercase">
              {m.board_states_answer()}
            </span>
            <BoardCaptionText
              text={boardState.answer}
              pins={boardState}
              pieces={document.steps[0]?.pieces ?? []}
              onHoverPiece={setHighlightedPieceId}
            />
          </div>
        ) : null}

        {step ? (
          <div className="flex flex-col gap-3">
            {total > 1 && (
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {m.board_states_step_of({ current: activeStep + 1, total })}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeStep === 0}
                    onClick={() => setActiveStep((index) => index - 1)}
                    aria-label={m.board_states_previous()}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeStep >= total - 1}
                    onClick={() => setActiveStep((index) => index + 1)}
                    aria-label={m.board_states_next()}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
            )}
            <BoardView document={document} step={step} highlightedPieceId={highlightedPieceId} />
            {step.caption ? (
              <BoardCaptionText
                text={step.caption}
                pins={boardState}
                pieces={step.pieces}
                onHoverPiece={setHighlightedPieceId}
              />
            ) : null}
          </div>
        ) : null}

        {ruleRefs.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs uppercase">
              {m.board_states_rules_used()}
            </span>
            <div className="flex flex-wrap gap-2">
              {ruleRefs.map((reference) => (
                <RuleChip
                  key={`${reference.kind}:${reference.ruleNumber}`}
                  reference={reference}
                  pins={boardState}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
