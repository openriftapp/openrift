import { RankBand } from "@/components/ui/rank-band";

export function StandingsRankCell({ rank }: { rank: number }) {
  return (
    <RankBand
      rank={rank}
      text={String(rank)}
      filled={false}
      className="min-w-10 shrink-0 rounded-md"
    />
  );
}
