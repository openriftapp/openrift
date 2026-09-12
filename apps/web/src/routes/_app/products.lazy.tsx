import type {
  ProductCoverCard,
  ProductSet,
  ProductSummary,
} from "@openrift/shared/contracts/products";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { CoverBand } from "@/components/cover-band";
import { Heading } from "@/components/heading";
import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card-link";
import { TextLink } from "@/components/ui/text-link";
import { CardFan, CardFanOutline } from "@/features/cards/components/card-fan";
import { ProductAddDialog } from "@/features/cards/components/product-add-dialog";
import { useProductsList } from "@/features/cards/hooks/use-products";
import { groupProductsBySet } from "@/features/cards/lib/group-products-by-set";
import { formatProductCounts } from "@/features/cards/lib/product-counts";
import { useSession } from "@/lib/auth-session";
import { markdownTeaser } from "@/lib/markdown-teaser";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/products")({
  component: ProductsIndexPage,
});

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
          covers={coverCards.map((cover) => ({ key: cover.printingId, imageId: cover.imageId }))}
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

function ProductsEmptyState() {
  return (
    <div className="flex flex-col items-center gap-1.5 pt-10 pb-6 text-center">
      <div aria-hidden="true" className="relative h-32 w-64 overflow-hidden">
        <CardFanOutline />
      </div>
      <Heading className="mt-2">{m.products_empty_title()}</Heading>
      <p className="text-muted-foreground max-w-[44ch] text-sm">{m.products_empty_body()}</p>
      <Button className="mt-3" render={<Link to="/contribute" />}>
        {m.products_empty_cta()}
      </Button>
    </div>
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
              size="icon-sm"
              className="absolute top-2 right-2 shadow-sm"
              aria-label={m.products_add_aria({ name: product.name })}
              onClick={() => onAdd(product)}
            >
              <PlusIcon />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ProductsIndexPage() {
  const { data } = useProductsList();
  const { products } = data;
  const groups = groupProductsBySet(products);
  const showHeadings = groups.some((group) => group.set !== null);
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
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.products_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "px-safe pt-3 pb-6")}>
        <PageDescription className="pb-4">{m.products_description()}</PageDescription>
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
