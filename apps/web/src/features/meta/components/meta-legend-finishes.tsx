import type { MetaLegendFinish } from "@openrift/shared/types/api/meta";
import { useState } from "react";

import { TableHead } from "@/components/ui/table";
import { FinishPhoneRow, FinishTableRow } from "@/features/meta/components/meta-finish-rows";
import { MetaFinishesSection } from "@/features/meta/components/meta-finishes-section";
import { MetaPlayerName } from "@/features/meta/components/meta-player-name";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

export function MetaLegendFinishes({
  best,
  finishes,
  total,
  loadingMore = false,
  onShowMore,
  narrowed = false,
}: {
  best: readonly MetaLegendFinish[];
  finishes: readonly MetaLegendFinish[];
  total: number;
  loadingMore?: boolean;
  onShowMore: () => void;
  narrowed?: boolean;
}) {
  const canSubmit = useUserId() !== null;
  const [view, setView] = useState<MetaFinishesView>("best");
  const rows = view === "best" ? best : finishes;

  return (
    <MetaFinishesSection
      total={total}
      emptyMessage={
        narrowed ? m.meta_finishes_legend_scope_empty() : m.meta_finishes_legend_empty()
      }
      canExpand={total > best.length}
      expanded={view === "all"}
      onToggleExpanded={() => setView(view === "best" ? "all" : "best")}
      remaining={total - rows.length}
      loadingMore={loadingMore}
      onShowMore={onShowMore}
      columns={
        <>
          <TableHead className="w-20">{m.meta_standings_col_rank()}</TableHead>
          <TableHead>{m.meta_finishes_col_event()}</TableHead>
          <TableHead className="w-24">{m.meta_finishes_col_tier()}</TableHead>
          <TableHead className="w-40">{m.meta_standings_col_player()}</TableHead>
          <TableHead className="w-20 text-right">{m.meta_finishes_col_record()}</TableHead>
          <TableHead className="w-24 text-right">{m.meta_standings_decklist()}</TableHead>
        </>
      }
      tableRows={rows.map((finish) => (
        <FinishTableRow
          key={finish.playerId}
          finish={finish}
          identity={<MetaPlayerName name={finish.playerName} playerKey={finish.playerKey} />}
          identityClassName="w-40 max-w-40 truncate font-medium"
          submitSearch={canSubmit ? metaSubmitSearchForPlayer(finish) : null}
        />
      ))}
      phoneRows={rows.map((finish) => (
        <FinishPhoneRow
          key={finish.playerId}
          finish={finish}
          identity={
            <MetaPlayerName
              name={finish.playerName}
              playerKey={finish.playerKey}
              className="truncate font-medium"
            />
          }
          submitSearch={canSubmit ? metaSubmitSearchForPlayer(finish) : null}
        />
      ))}
    />
  );
}
