import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";

import { PAGE_HERO_EYEBROW_CLASS } from "@/components/layout/page-hero";
import { TextLink } from "@/components/ui/text-link";
import type { AuthDestination } from "@/features/account/lib/auth-destination";
import { m } from "@/paraglide/messages.js";

export function AuthDestinationPanel({ destination }: { destination: AuthDestination }) {
  return (
    <div className="flex h-full flex-col gap-5 p-8">
      <p className={PAGE_HERO_EYEBROW_CLASS}>{destination.label}</p>
      <ul className="flex flex-col gap-3">
        {destination.perks.map((perk) => (
          <li key={perk} className="flex gap-2.5">
            <CheckIcon aria-hidden className="text-primary mt-1 size-4 shrink-0" />
            <span>{perk}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-auto text-pretty">
        <ParaglideMessage
          message={m.auth_destination_no_account}
          markup={{
            cards: ({ children }) => <TextLink render={<Link to="/cards" />}>{children}</TextLink>,
            decks: ({ children }) => <TextLink render={<Link to="/decks" />}>{children}</TextLink>,
          }}
        />
      </p>
    </div>
  );
}
