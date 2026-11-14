import { HeroCta } from "@/features/marketing/components/hero-cta";
import { useUserId } from "@/hooks/use-session";
import { trackSignupCta } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// No hydration gate: the shared page cache serves only anonymous requests, so the server render
// already knows whether the viewer is signed in.
export function HeroCtas({ source, className }: { source: string; className?: string }) {
  const signedIn = useUserId() !== null;
  return (
    <div className={cn("my-3 flex flex-wrap items-center justify-center gap-3", className)}>
      <HeroCta to="/cards">{m.collections_activity_browse_cards()}</HeroCta>
      {signedIn ? null : (
        <HeroCta
          rel="nofollow"
          to="/signup"
          search={{ redirect: undefined, email: undefined }}
          variant="outline"
          onClick={() => trackSignupCta(source)}
        >
          {m.card_detail_nudge_signup()}
        </HeroCta>
      )}
    </div>
  );
}
