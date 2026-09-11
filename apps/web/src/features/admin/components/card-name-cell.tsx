import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";

export function CardNameCell({ row }: { row: CandidateCardSummaryResponse }) {
  // A name with no letters or digits at all normalizes to "", the lookup key
  // for the unmatched-card route: render as plain text.
  const linkable = Boolean(row.cardSlug) || row.normalizedName !== "";

  if (!linkable) {
    return <span className="font-medium">{row.name}</span>;
  }

  return (
    <Link
      to={row.cardSlug ? "/admin/cards/$cardSlug" : "/admin/cards/new/$name"}
      params={row.cardSlug ? { cardSlug: row.cardSlug } : { name: row.normalizedName }}
      className="font-medium hover:underline"
    >
      {row.name}
    </Link>
  );
}
