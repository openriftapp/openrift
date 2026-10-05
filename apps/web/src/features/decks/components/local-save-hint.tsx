import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { CloudOffIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSignInSearch } from "@/hooks/use-sign-in-search";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function SignInLink({ children }: { children?: ReactNode }) {
  const signIn = useSignInSearch();
  return (
    <TextLink variant="muted" className="font-medium" render={<Link {...signIn} />}>
      {children}
    </TextLink>
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
        <ParaglideMessage
          message={m.decks_local_note}
          markup={{ link: ({ children }) => <SignInLink>{children}</SignInLink> }}
        />
      </span>
    </p>
  );
}

export function LocalDeckSaveBanner({ className }: { className?: string }) {
  return (
    <p className={cn("text-muted-foreground flex items-start gap-1.5 text-sm", className)}>
      <CloudOffIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <ParaglideMessage
          message={m.decks_local_banner}
          markup={{ link: ({ children }) => <SignInLink>{children}</SignInLink> }}
        />
      </span>
    </p>
  );
}
