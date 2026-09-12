import { PageTopBarBack } from "@/components/layout/page-top-bar";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { UnmatchedProductsPanel } from "@/features/admin/components/unmatched-products-panel";

export function UnmatchedProductsPage() {
  return (
    <>
      <AdminPageTopBar
        title="Unmatched products"
        back={<PageTopBarBack to="/admin/cards" aria-label="Back to cards" />}
      />

      <UnmatchedProductsPanel />
    </>
  );
}
