import { Link } from "@tanstack/react-router";
import { CloudOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function SignInLink({ className }: { className?: string }) {
  return (
    <Link
      to="/login"
      // Redirect is hardcoded to /decks: this component only mounts there.
      search={{ redirect: "/decks", email: undefined }}
      className={cn("hover:text-foreground font-medium underline", className)}
    >
      {m.common_sign_in()}
    </Link>
  );
}

// The Badge is the tooltip trigger (via `render`) so it stays a span, valid
// inside the anchor-wrapped list rows/tiles.
export function LocalDeckBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="secondary" className={className} />}>
        {m.decks_local_badge_on_device()}
      </TooltipTrigger>
      <TooltipContent className="max-w-56 text-center">
        {m.decks_local_badge_tooltip()}
      </TooltipContent>
    </Tooltip>
  );
}

export function LocalDeckSaveNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground flex items-start gap-1.5 text-sm", className)}>
      <CloudOffIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {m.decks_local_note_before()} <SignInLink /> {m.decks_local_note_after()}
      </span>
    </p>
  );
}

export function LocalDeckSaveBanner({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground flex items-start gap-1.5 text-sm", className)}>
      <CloudOffIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {m.decks_local_banner_before()} <SignInLink /> {m.decks_local_banner_after()}
      </span>
    </p>
  );
}
