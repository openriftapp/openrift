import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { BookmarkPlusIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/hooks/use-session";
import { useSignInSearch } from "@/hooks/use-sign-in-search";
import { trackSignupCta } from "@/lib/analytics";
import { m } from "@/paraglide/messages.js";

const CardPageCollectionActions = lazy(async () => {
  const mod = await import("@/features/cards/components/card-page-collection-actions");
  return { default: mod.CardPageCollectionActions };
});

// The counts come from a live query with no server snapshot, so this mounts
// only after hydration to avoid a server/client mismatch.
export function CollectionSlot({
  printing,
  siblings,
}: {
  printing: Printing;
  siblings: readonly Printing[];
}) {
  const { data: session } = useSession();
  const hydrated = useHydrated();
  if (!session?.user) {
    return null;
  }
  const placeholder = <div aria-hidden className="bg-card h-10 rounded-lg border" />;
  if (!hydrated) {
    return placeholder;
  }
  return (
    <Suspense fallback={placeholder}>
      <CardPageCollectionActions printing={printing} siblings={siblings} />
    </Suspense>
  );
}

export function SignupNudgeSlot() {
  const { data: session, isPending } = useSession();
  if (isPending || session?.user) {
    return null;
  }
  return <TrackCollectionNudge />;
}

function TrackCollectionNudge() {
  const { search } = useSignInSearch();
  return (
    <div className="bg-primary/10 border-primary/30 flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <BookmarkPlusIcon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-sm">{m.card_detail_nudge_text()}</p>
      </div>
      <Link
        rel="nofollow"
        to="/signup"
        search={search}
        className={buttonVariants({ className: "h-11 w-full" })}
        onClick={() => trackSignupCta("card-page")}
      >
        {m.card_detail_nudge_signup()}
      </Link>
      <p className="text-muted-foreground text-center text-sm">
        {m.auth_signup_have_account()}{" "}
        <Link
          rel="nofollow"
          to="/login"
          search={search}
          className="text-foreground underline underline-offset-2"
        >
          {m.common_sign_in()}
        </Link>
      </p>
    </div>
  );
}
