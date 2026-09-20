import type {
  CardTradeLiveAnnotation,
  CardTradeLivePhase,
  CardTradeRole,
} from "@openrift/shared/types/api/card-trade";
import { LayersIcon, MinusIcon, PackageIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CountPill } from "@/components/ui/count-pill";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { CardCountStrip } from "@/features/cards/components/card-count-strip";
import {
  CardStrip,
  StripActionButton,
  StripIconButton,
} from "@/features/cards/components/card-strip";
import { OnLoanChip } from "@/features/groups/components/on-loan-chip";
import {
  SharedTradeStatusChip,
  TradeStatusChip,
} from "@/features/groups/components/trade-status-chip";

const GROUPS = {
  strip: { id: "card-strips-strip", title: "CardStrip" },
  countStrip: { id: "card-strips-count-strip", title: "CardCountStrip" },
  tradeChips: { id: "card-strips-trade-chips", title: "Trade chips" },
} as const;

export const CARD_STRIPS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const LIVE_TRADE_PHASES: CardTradeLivePhase[] = ["asked", "offered", "reserved"];

function demoTradeAnnotation(
  role: CardTradeRole,
  phase: CardTradeLivePhase,
): CardTradeLiveAnnotation {
  return { printingId: "printing-1", role, phase, tradeCount: 1, quantity: 2 };
}

export function CardStripsSection() {
  const [ownedCount, setOwnedCount] = useState(2);

  return (
    <DemoSection
      id="card-strips"
      title="Card strips"
      note="The 24px row above a card tile, and the pills and chips that ride in it."
    >
      <DemoGroup
        {...GROUPS.strip}
        hint="The flex-1 side zones keep the center pills dead-centered however wide the sides get."
      >
        <SwatchRow label="Zones">
          <Swatch label="left · center · right">
            <div className="w-56">
              <CardStrip
                left={
                  <StripIconButton
                    className="text-muted-foreground"
                    aria-label="Remove from deck"
                    onClick={() => toast.success("Removed")}
                  >
                    <MinusIcon />
                  </StripIconButton>
                }
                center={
                  <>
                    <CountPill variant="ghost" title="3 owned">
                      <PackageIcon className="size-3" />
                      <span>3</span>
                    </CountPill>
                    <CountPill variant="primary" title="2 in deck">
                      <LayersIcon className="size-3" />
                      <span>2</span>
                    </CountPill>
                  </>
                }
                right={
                  <StripIconButton
                    className="text-muted-foreground"
                    aria-label="Add to deck"
                    onClick={() => toast.success("Added")}
                  >
                    <PlusIcon />
                  </StripIconButton>
                }
              />
            </div>
          </Swatch>
          <Swatch label="zero count · action">
            <div className="w-56">
              <CardStrip
                center={
                  <CountPill variant="ghost" className="opacity-50">
                    <PackageIcon className="size-3" />
                    <span>0</span>
                  </CountPill>
                }
                right={
                  <StripActionButton onClick={() => toast.success("Chosen")}>
                    Choose
                  </StripActionButton>
                }
              />
            </div>
          </Swatch>
          <Swatch label="destructive action">
            <div className="w-56">
              <CardStrip
                right={
                  <StripActionButton variant="destructive" onClick={() => toast.success("Removed")}>
                    Remove
                  </StripActionButton>
                }
              />
            </div>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.countStrip}
        hint="A totalCount renders as N (M), and a zero count without one dims the pill."
      >
        <SwatchRow label="Counts">
          <Swatch label="steppable">
            <div className="w-40">
              <CardCountStrip
                count={ownedCount}
                icon={PackageIcon}
                decrement={{
                  onClick: () => setOwnedCount((c) => Math.max(0, c - 1)),
                  disabled: ownedCount === 0,
                  ariaLabel: "Remove one copy",
                }}
                increment={{
                  onClick: () => setOwnedCount((c) => c + 1),
                  ariaLabel: "Add one copy",
                }}
              />
            </div>
          </Swatch>
          <Swatch label="read-only">
            <div className="w-40">
              <CardCountStrip count={1} totalCount={4} icon={PackageIcon} />
            </div>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.tradeChips}
        hint="Weight carries how binding the state is, never colour, so these stay ghost next to OnLoanChip."
      >
        <DemoRow label="Giver" hint='detail="label", the arrow points out'>
          {LIVE_TRADE_PHASES.map((phase) => (
            <TradeStatusChip
              key={phase}
              detail="label"
              annotation={demoTradeAnnotation("giver", phase)}
            />
          ))}
        </DemoRow>
        <DemoRow label="Receiver" hint='detail="label", the arrow points in'>
          {LIVE_TRADE_PHASES.map((phase) => (
            <TradeStatusChip
              key={phase}
              detail="label"
              annotation={demoTradeAnnotation("receiver", phase)}
            />
          ))}
        </DemoRow>
        <DemoRow
          label="In a strip"
          hint='detail="count" is the strip default, "icon" the copies view, "word" the per-copy rows'
        >
          <TradeStatusChip annotation={demoTradeAnnotation("giver", "reserved")} />
          <TradeStatusChip annotation={demoTradeAnnotation("giver", "asked")} totalCount={5} />
          <TradeStatusChip detail="icon" annotation={demoTradeAnnotation("receiver", "reserved")} />
          <TradeStatusChip detail="word" annotation={demoTradeAnnotation("giver", "offered")} />
          <div className="w-40">
            <CardStrip
              center={
                <>
                  <OnLoanChip count={1} />
                  <TradeStatusChip annotation={demoTradeAnnotation("giver", "offered")} />
                </>
              }
            />
          </div>
        </DemoRow>
        <DemoRow
          label="Shared"
          hint="Share links, where reserved means not claimable and no prop can carry a name"
        >
          <SharedTradeStatusChip />
          <SharedTradeStatusChip count={2} />
          <SharedTradeStatusChip detail="icon" />
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
