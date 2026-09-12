import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const MAX_NAMED_CONTRIBUTORS = 3;

function contributorLine(names: readonly string[]): string {
  const hiddenCount = names.length - MAX_NAMED_CONTRIBUTORS;
  const shown = hiddenCount > 1 ? names.slice(0, MAX_NAMED_CONTRIBUTORS) : [...names];
  const remainder = names.length - shown.length;
  const tail =
    remainder > 0 ? m.meta_contributors_others({ count: String(remainder) }) : shown.pop();
  if (shown.length === 0) {
    return tail ?? "";
  }
  return m.meta_join_and({ names: shown.join(", "), last: tail ?? "" });
}

// Names arrive already filtered by each contributor's visibility setting and
// render as plain text; linking to a profile is a separate consent question.
export function MetaContributors({
  contributors,
  className,
}: {
  contributors: readonly string[];
  className?: string;
}) {
  if (contributors.length === 0) {
    return null;
  }
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      {m.meta_contributors_line({ names: contributorLine(contributors) })}
    </p>
  );
}
