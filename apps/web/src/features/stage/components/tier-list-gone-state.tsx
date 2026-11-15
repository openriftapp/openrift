import { Link } from "@tanstack/react-router";

import { LinkGoneState } from "@/components/link-gone-state";
import { buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function TierListGoneState() {
  return (
    <LinkGoneState
      title={m.tier_lists_not_found_title()}
      description={m.tier_lists_not_found_description()}
      action={
        <Link to="/tier-lists" className={buttonVariants()}>
          {m.tier_lists_not_found_action()}
        </Link>
      }
    />
  );
}
