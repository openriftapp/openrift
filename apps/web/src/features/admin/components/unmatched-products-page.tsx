import { countNoun, pluralize } from "@openrift/shared/strings";
import { getRouteApi, Link } from "@tanstack/react-router";

import { PageTopBarBack } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { UnmatchedProductsPanel } from "@/features/admin/components/unmatched-products-panel";
import { useUnifiedMappings } from "@/features/admin/hooks/use-unified-mappings";
import { scopeUnmatchedRows } from "@/features/admin/lib/unmatched-scope";
import { useSets } from "@/features/cards/hooks/use-sets";

const routeApi = getRouteApi("/_app/_authenticated/admin/unmatched");

export function UnmatchedProductsPage() {
  const setSlug = routeApi.useSearch({ select: (s) => s.set });

  return (
    <>
      <AdminPageTopBar
        title="Unmatched products"
        back={
          <PageTopBarBack to="/admin/cards" search={{ set: setSlug }} aria-label="Back to cards" />
        }
      />

      <div className="space-y-4">
        {setSlug && <SetScope setSlug={setSlug} />}
        <UnmatchedProductsPanel setSlug={setSlug} />
      </div>
    </>
  );
}

function SetScope({ setSlug }: { setSlug: string }) {
  const navigate = routeApi.useNavigate();
  const { data: setsData } = useSets();
  const { data } = useUnifiedMappings();
  const { unattributedCount } = scopeUnmatchedRows(data.unmatchedProducts, setSlug);
  const setName = setsData.sets.find((set) => set.slug === setSlug)?.name ?? setSlug;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge variant="outline">
        Set: {setName}
        <ChipRemoveButton
          aria-label="Show all sets"
          onClick={() => {
            void navigate({ search: {} });
          }}
        />
      </Badge>
      {unattributedCount > 0 && (
        <p className="text-muted-foreground">
          {countNoun(unattributedCount, "product")} in marketplace groups without a set{" "}
          {pluralize(unattributedCount, "is", "are")} listed only under{" "}
          <Link to="/admin/unmatched" className="underline underline-offset-2">
            all sets
          </Link>
          .
        </p>
      )}
    </div>
  );
}
