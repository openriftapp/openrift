import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { PackageIcon } from "lucide-react";
import { lazy, Suspense } from "react";

import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSession } from "@/lib/auth-session";

const CardPageCollectionActions = lazy(async () => {
  const m = await import("@/features/cards/components/card-page-collection-actions");
  return { default: m.CardPageCollectionActions };
});

// The counts come from a live query with no server snapshot, so this mounts
// only after hydration to avoid a server/client mismatch.
export function CollectionSlot({
  cardSlug,
  printing,
  siblings,
}: {
  cardSlug: string;
  printing: Printing;
  siblings: readonly Printing[];
}) {
  const { data: session, isPending } = useSession();
  const hydrated = useHydrated();
  if (isPending) {
    return null;
  }
  if (!session?.user) {
    return <TrackCollectionNudge cardSlug={cardSlug} />;
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

function TrackCollectionNudge({ cardSlug }: { cardSlug: string }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionHeading icon={PackageIcon}>Your copies</SectionHeading>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          Keep count of your copies of this card, with wishlists and tradelists that update
          themselves.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto"
          render={
            <Link to="/signup" search={{ redirect: `/cards/${cardSlug}`, email: undefined }} />
          }
        >
          Sign up free
        </Button>
      </div>
    </section>
  );
}
