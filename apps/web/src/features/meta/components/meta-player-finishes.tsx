import type { MetaPlayerFinish } from "@openrift/shared/types/api/meta";
import { useState } from "react";

import { TableHead } from "@/components/ui/table";
import { FinishPhoneRow, FinishTableRow } from "@/features/meta/components/meta-finish-rows";
import { MetaFinishesSection } from "@/features/meta/components/meta-finishes-section";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import type { MetaFinishesView } from "@/features/meta/lib/meta-legend-page";
import { BEST_FINISH_COUNT, FINISH_PAGE_SIZE } from "@/features/meta/lib/meta-legend-page";
import { sortPlayerFinishes } from "@/features/meta/lib/meta-player-page";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { useUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

function LegendCell({ finish, className }: { finish: MetaPlayerFinish; className?: string }) {
  const { legend } = finish;
  if (legend === null) {
    return (
      <span className="text-muted-foreground text-xs">{m.meta_player_finishes_no_legend()}</span>
    );
  }
  return (
    <MetaIdentity
      legend={legend}
      slug={legend.slug}
      archiveSlug={legend.archiveSlug}
      domains={legend.domains}
      className={className}
    />
  );
}

export function MetaPlayerFinishes({
  finishes,
  playerName,
  narrowed = false,
}: {
  finishes: readonly MetaPlayerFinish[];
  playerName: string;
  narrowed?: boolean;
}) {
  const canSubmit = useUserId() !== null;
  const [view, setView] = useState<MetaFinishesView>("best");
  const [shown, setShown] = useState(FINISH_PAGE_SIZE);
  const sorted = sortPlayerFinishes(finishes, view);
  const rows = view === "best" ? sorted.slice(0, BEST_FINISH_COUNT) : sorted.slice(0, shown);

  return (
    <MetaFinishesSection
      total={finishes.length}
      emptyMessage={
        narrowed ? m.meta_finishes_player_scope_empty() : m.meta_finishes_player_empty()
      }
      canExpand={finishes.length > BEST_FINISH_COUNT}
      expanded={view === "all"}
      onToggleExpanded={() => setView(view === "best" ? "all" : "best")}
      remaining={finishes.length - rows.length}
      onShowMore={() => setShown(shown + FINISH_PAGE_SIZE)}
      columns={
        <>
          <TableHead className="w-20">{m.meta_standings_col_rank()}</TableHead>
          <TableHead>{m.meta_finishes_col_event()}</TableHead>
          <TableHead className="w-24">{m.meta_finishes_col_tier()}</TableHead>
          <TableHead className="w-72">{m.meta_standings_col_legend()}</TableHead>
          <TableHead className="w-20 text-right">{m.meta_finishes_col_record()}</TableHead>
          <TableHead className="w-24 text-right">{m.meta_standings_decklist()}</TableHead>
        </>
      }
      tableRows={rows.map((finish) => (
        <FinishTableRow
          key={finish.playerId}
          finish={finish}
          identity={<LegendCell finish={finish} />}
          identityClassName="w-72 max-w-72"
          submitSearch={canSubmit ? metaSubmitSearchForPlayer({ ...finish, playerName }) : null}
        />
      ))}
      phoneRows={rows.map((finish) => (
        <FinishPhoneRow
          key={finish.playerId}
          finish={finish}
          identity={<LegendCell finish={finish} />}
          submitSearch={canSubmit ? metaSubmitSearchForPlayer({ ...finish, playerName }) : null}
        />
      ))}
    />
  );
}
