import { BOOSTERS } from "@openrift/shared/boosters/definitions";
import { createLazyFileRoute } from "@tanstack/react-router";

import { BoosterPage, boosterPageLanguage } from "@/features/boosters/components/booster-page";
import { ProductDetailView } from "@/features/cards/components/product-detail-view";
import { useProductDetail } from "@/features/cards/hooks/use-products";

export const Route = createLazyFileRoute("/_app/products_/$slug")({
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  return slug in BOOSTERS ? <BoosterProductPage slug={slug} /> : <ProductDetailPage slug={slug} />;
}

function BoosterProductPage({ slug }: { slug: string }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <BoosterPage
      slug={slug}
      language={boosterPageLanguage(slug, search.languages?.[0])}
      onLanguageChange={(language) =>
        void navigate({ search: { languages: [language] }, replace: true })
      }
    />
  );
}

function ProductDetailPage({ slug }: { slug: string }) {
  const search = Route.useSearch();
  const { data } = useProductDetail(slug);
  return <ProductDetailView data={data} search={search} />;
}
