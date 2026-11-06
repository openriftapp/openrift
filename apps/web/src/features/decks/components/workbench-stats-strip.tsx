import { enumLabel } from "@openrift/shared/enum-label";
import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDeckCards, useDeckViolations } from "@/features/decks/hooks/use-deck-builder";
import { useDeckStats } from "@/features/decks/hooks/use-deck-stats";
import { useDeckDetail } from "@/features/decks/hooks/use-decks";
import { useEnumOrders } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function WorkbenchStatsStrip({ deckId, compact }: { deckId: string; compact?: boolean }) {
  const cards = useDeckCards(deckId);
  const { data } = useDeckDetail(deckId);
  const violations = useDeckViolations(deckId, data.deck.format, data.deck.formatConfig);
  const stats = useDeckStats(cards);
  const { labels } = useEnumOrders();

  const curve = stats.energyCurve.map((entry) => ({
    energy: entry.energy,
    count: stats.energyCurveStacks.reduce((sum, stack) => sum + Number(entry[stack.key] ?? 0), 0),
  }));
  const peak = Math.max(1, ...curve.map((entry) => entry.count));
  const showCurve = curve.filter((entry) => entry.count > 0).length >= 3;
  const types = stats.typeBreakdown.map((entry) => ({
    label: enumLabel(labels.cardTypes, entry.type),
    total: entry.total,
  }));

  const warnings =
    violations.length > 0 ? (
      <Popover>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size={compact ? "sm" : "default"}
              className={cn("text-destructive border-destructive/40", !compact && "w-full")}
            />
          }
        >
          <AlertTriangleIcon className="size-4" />
          {compact
            ? violations.length
            : m.decks_workbench_rule_warnings({ count: violations.length })}
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-auto max-w-80 p-2">
          <ul className="space-y-1">
            {violations.map((violation) => (
              <li
                key={`${violation.code}-${violation.cardId ?? violation.zone}`}
                className="text-xs"
              >
                {violation.message}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    ) : null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 border-t pt-2">
        {showCurve && (
          <div
            role="img"
            aria-label={m.decks_workbench_energy_curve()}
            className="flex h-6 w-14 items-end gap-0.5"
          >
            {curve.map((entry) => (
              <span
                key={entry.energy}
                className="bg-primary/80 block flex-1 rounded-t-sm"
                style={{ height: `${Math.max(8, Math.round((entry.count / peak) * 100))}%` }}
              />
            ))}
          </div>
        )}
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {types.map((entry) => `${entry.total} ${entry.label}`).join(" · ")}
        </span>
        {warnings}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 border-t pt-3">
      <div className="flex items-stretch gap-4">
        {showCurve && (
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-muted-foreground text-2xs tracking-wide uppercase">
              {m.decks_workbench_energy()}
            </span>
            <div className="flex gap-1">
              {curve.map((entry) => (
                <div key={entry.energy} className="flex flex-1 flex-col items-center gap-0.5">
                  <span className="text-muted-foreground text-2xs tabular-nums">{entry.count}</span>
                  <div className="flex h-8 w-full items-end">
                    <span
                      className="bg-primary/85 block w-full rounded-t-sm"
                      style={{ height: `${Math.max(8, Math.round((entry.count / peak) * 100))}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-2xs">{entry.energy}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <dl
          className={cn("flex flex-col justify-end gap-0.5 text-xs", showCurve ? "w-24" : "flex-1")}
        >
          {types.map((entry) => (
            <div key={entry.label} className="flex justify-between gap-2">
              <dt className="text-muted-foreground truncate">{entry.label}</dt>
              <dd className="tabular-nums">{entry.total}</dd>
            </div>
          ))}
        </dl>
      </div>
      {warnings}
    </div>
  );
}
