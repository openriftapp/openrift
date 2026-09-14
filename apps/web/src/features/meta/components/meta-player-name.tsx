import { Link } from "@tanstack/react-router";

import { TextLink } from "@/components/ui/text-link";
import { cn } from "@/lib/utils";

export interface MetaPlayerNameProps {
  name: string;
  playerKey: string | null | undefined;
  /**
   * Positions the link so the name still takes its own clicks inside a
   * stretched-link tile, where an unpositioned anchor sits under the overlay.
   */
  inStretchedTile?: boolean;
  /** Links the name to the player's run through this event instead of their archive page. */
  eventSlug?: string;
  className?: string;
}

/**
 * Never inside a wrapper that is itself a link: an anchor inside an anchor is
 * invalid, so those surfaces print the name plain.
 */
export function MetaPlayerName({
  name,
  playerKey,
  inStretchedTile = false,
  eventSlug,
  className,
}: MetaPlayerNameProps) {
  if (playerKey === null || playerKey === undefined || playerKey === "") {
    return <span className={className}>{name}</span>;
  }

  return (
    <TextLink
      variant="inherit"
      className={cn(inStretchedTile && "relative", className)}
      render={
        eventSlug === undefined ? (
          <Link to="/meta/players/$key" params={{ key: playerKey }} />
        ) : (
          <Link to="/meta/$slug/players/$key" params={{ slug: eventSlug, key: playerKey }} />
        )
      }
    >
      {name}
    </TextLink>
  );
}
