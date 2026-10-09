import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
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
  const { data: session, isPending } = useSession();
  const hydrated = useHydrated();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <TrackCollectionNudge />;
  }
  if (!hydrated) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <CardPageCollectionActions printing={printing} siblings={siblings} />
    </Suspense>
  );
}

function TrackCollectionNudge() {
  const { search } = useSignInSearch();
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading icon={PackageIcon}>{m.card_detail_copies_title()}</SectionHeading>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-muted-foreground text-sm">{m.card_detail_nudge_text()}</p>
        <Link
          to="/signup"
          search={search}
          className={buttonVariants({ variant: "outline", size: "sm" })}
          onClick={() => trackSignupCta("card-page")}
        >
          {m.card_detail_nudge_signup()}
        </Link>
      </div>
    </section>
  );
}
