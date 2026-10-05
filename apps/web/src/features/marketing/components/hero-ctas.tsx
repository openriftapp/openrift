import { HeroCta } from "@/features/marketing/components/hero-cta";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function HeroCtas({ className }: { className?: string }) {
  return (
    <div className={cn("my-3 flex flex-wrap items-center justify-center gap-3", className)}>
      <HeroCta to="/cards">{m.collections_activity_browse_cards()}</HeroCta>
      <HeroCta to="/signup" search={{ redirect: undefined, email: undefined }} variant="outline">
        {m.card_detail_nudge_signup()}
      </HeroCta>
    </div>
  );
}
