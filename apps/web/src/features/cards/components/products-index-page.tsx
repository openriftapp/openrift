import { BOOSTERS, cardsPerPack } from "@openrift/shared/boosters/definitions";
import type {
  ProductCoverCard,
  ProductSet,
  ProductSummary,
} from "@openrift/shared/contracts/products";
import { imageUrl } from "@openrift/shared/image-url";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { CardFan, CardFanOutline } from "@/components/card-fan";
import { CoverBand } from "@/components/cover-band";
import { EmptyState } from "@/components/empty-state";
import { Heading } from "@/components/heading";
import { PageHero, PageHeroCardFan } from "@/components/layout/page-hero";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card-link";
import { TextLink } from "@/components/ui/text-link";
import { boosterName } from "@/features/boosters/lib/booster-labels";
import { ProductAddDialog } from "@/features/cards/components/product-add-dialog";
import { useProductsList } from "@/features/cards/hooks/use-products";
import { groupProductsBySet } from "@/features/cards/lib/group-products-by-set";
import { formatProductCounts } from "@/features/cards/lib/product-counts";
import { publicSetListQueryOptions } from "@/features/cards/lib/public-sets-queries";
import { useSession } from "@/hooks/use-session";
import { formatCount } from "@/lib/format";
import { markdownTeaser } from "@/lib/markdown-teaser";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function ProductCoverFan({
  coverCards,
  priority,
}: {
  coverCards: ProductCoverCard[];
  priority?: boolean;
}) {
  // overflow-hidden crops the fan's bottom bleed at the band edge, so the
  // rotated card corners never paint over the name below.
  return (
    <CoverBand aria-hidden="true" className="h-36 overflow-hidden">
      {coverCards.length === 0 ? (
        <CardFanOutline />
      ) : (
        <CardFan
          covers={coverCards.map((cover, index) => ({
            key: `${cover.printingId}-${index}`,
            imageId: cover.imageId,
          }))}
          priority={priority}
        />
      )}
    </CoverBand>
  );
}

function ProductTile({
  product,
  titleAs,
  priority,
}: {
  product: ProductSummary;
  titleAs: "h2" | "h3";
  priority?: boolean;
}) {
  const teaser = markdownTeaser(product.description);
  return (
    <CardLink
      render={<Link to="/products/$slug" params={{ slug: product.slug }} />}
      className="flex-col gap-0 py-0"
    >
      <ProductCoverFan coverCards={product.coverCards} priority={priority} />
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
        <Heading as={titleAs} className="truncate">
          {product.name}
        </Heading>
        {teaser && <p className="text-muted-foreground line-clamp-2 text-sm">{teaser}</p>}
        <p className="text-muted-foreground mt-auto pt-1 text-sm">
          {formatProductCounts(product.cardTotal, product.printingCount)}
        </p>
      </div>
    </CardLink>
  );
}

function BoosterGrid({ covers }: { covers: Record<string, ProductCoverCard[]> }) {
  const { data: setList } = useSuspenseQuery(publicSetListQueryOptions);
  const setsBySlug = new Map(setList.sets.map((set) => [set.slug, set]));
  return (
    <section className="mb-8">
      <Heading className="mb-6">{m.products_boosters_heading()}</Heading>
      <ul className="grid gap-4 sm:grid-cols-2">
        {Object.entries(BOOSTERS).map(([slug, booster]) => {
          const set = setsBySlug.get(booster.set);
          const english = booster.languages.EN;
          return (
            <li key={slug}>
              <CardLink
                render={<Link to="/products/$slug" params={{ slug }} />}
                className="flex-col gap-0 py-0"
              >
                <ProductCoverFan coverCards={covers[slug] ?? []} />
                <div className="flex min-w-0 flex-1 flex-col gap-1 p-4">
                  <Heading as="h3" className="truncate">
                    {boosterName(set?.name ?? booster.set)}
                  </Heading>
                  {english && (
                    <p className="text-muted-foreground mt-auto pt-1 text-sm">
                      {m.booster_page_lead({
                        cards: formatCount(cardsPerPack(booster)),
                        packs: formatCount(english.packsPerBox),
                        boxes: formatCount(english.boxesPerCase),
                      })}
                    </p>
                  )}
                </div>
              </CardLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ProductsEmptyState() {
  return (
    <EmptyState title={m.products_empty_title()}>
      <Link to="/contribute" className={buttonVariants()}>
        {m.products_empty_cta()}
      </Link>
    </EmptyState>
  );
}

function ProductGroupHeading({ set }: { set: ProductSet | null }) {
  if (!set) {
    return <Heading className="mb-6">{m.products_other_group()}</Heading>;
  }
  return (
    <Heading className="mb-6">
      <TextLink
        variant="inherit"
        render={<Link to="/sets/$setSlug" params={{ setSlug: set.slug }} />}
      >
        {set.name}
      </TextLink>
    </Heading>
  );
}

const EAGER_TILE_COUNT = 2;

function ProductGrid({
  products,
  onAdd,
  titleAs,
  eager,
}: {
  products: ProductSummary[];
  onAdd?: (product: ProductSummary) => void;
  titleAs: "h2" | "h3";
  eager?: boolean;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {products.map((product, index) => (
        // relative hosts the quick-add overlay as a sibling of the tile
        // link, so the button never nests inside the anchor.
        <li key={product.id} className="relative">
          <ProductTile
            product={product}
            titleAs={titleAs}
            priority={eager && index < EAGER_TILE_COUNT}
          />
          {onAdd && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 shadow-sm"
              onClick={() => onAdd(product)}
            >
              <PlusIcon />
              {m.products_add_to_collection()}
              <span className="sr-only">: {product.name}</span>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ProductsIndexPage() {
  const { data } = useProductsList();
  const { products } = data;
  const groups = groupProductsBySet(products);
  const showHeadings = groups.some((group) => group.set !== null);
  const coverUrls = groups
    .flatMap((group) => group.products)
    .flatMap((product) => product.coverCards.slice(0, 1))
    .slice(0, 3)
    .map((cover) => imageUrl(cover.imageId, "400w"));
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user);
  // The dialog keeps the last-picked product while closing so the exit
  // animation doesn't run on an empty shell.
  const [addProduct, setAddProduct] = useState<ProductSummary | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const handleAdd = isLoggedIn
    ? (product: ProductSummary) => {
        setAddProduct(product);
        setAddOpen(true);
      }
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHero
        title={m.products_title()}
        lead={
          <>
            {m.products_hero_lead()} {m.products_hero_missing()}{" "}
            <TextLink variant="inherit" render={<Link to="/contribute" />}>
              {m.products_hero_contribute_link()}
            </TextLink>
            .
          </>
        }
        aside={<PageHeroCardFan urls={coverUrls} />}
      />
      <div className={cn(PAGE_WIDTH.capped, "px-safe pt-3 pb-6")}>
        <BoosterGrid covers={data.boosterCovers} />
        {products.length === 0 ? (
          <ProductsEmptyState />
        ) : (
          groups.map((group, index) => (
            <section key={group.key} className={index > 0 ? "mt-8" : undefined}>
              {showHeadings && <ProductGroupHeading set={group.set} />}
              <ProductGrid
                products={group.products}
                onAdd={handleAdd}
                titleAs={showHeadings ? "h3" : "h2"}
                eager={index === 0}
              />
            </section>
          ))
        )}
      </div>
      {addProduct && (
        <ProductAddDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          productSlug={addProduct.slug}
          productName={addProduct.name}
        />
      )}
    </div>
  );
}
