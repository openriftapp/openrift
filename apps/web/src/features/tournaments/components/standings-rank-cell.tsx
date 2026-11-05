import { RankBand } from "@/components/ui/rank-band";

export function StandingsRankCell({ rank }: { rank: number }) {
  return <RankBand rank={rank} text={String(rank)} filled={false} className="w-14 shrink-0" />;
}
