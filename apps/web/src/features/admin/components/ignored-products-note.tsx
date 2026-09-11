import { Link } from "@tanstack/react-router";

import { TextLink } from "@/components/ui/text-link";

export function IgnoredProductsNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Products you told the catalog to skip are not listed here.{" "}
      <TextLink render={<Link to="/admin/ignored-products" />}>Ignored products</TextLink> lists
      them and can bring one back.
    </p>
  );
}
