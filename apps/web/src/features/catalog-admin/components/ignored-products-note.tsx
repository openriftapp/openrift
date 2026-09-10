import { Link } from "@tanstack/react-router";

export function IgnoredProductsNote() {
  return (
    <p className="text-muted-foreground text-sm">
      Products you told the catalog to skip are not listed here.{" "}
      <Link to="/admin/ignored-products" className="text-primary hover:underline">
        Ignored products
      </Link>{" "}
      lists them and can bring one back.
    </p>
  );
}
