import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const calloutVariants = cva("relative", {
  variants: {
    variant: {
      default: "bg-muted/30 rounded-lg border p-4",
      inset: "bg-muted rounded-md p-3",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Callout({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof calloutVariants>) {
  return (
    <div data-slot="callout" className={cn(calloutVariants({ variant }), className)} {...props} />
  );
}

export { Callout };
