import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded); keep in sync with
// `buttonVariants` `link` / `link-muted` and the `[&_a]` selectors in alert,
// accordion, empty, field and markdown-text, which mirror these strings.
const textLinkVariants = cva("underline-offset-4 hover:underline", {
  variants: {
    variant: {
      default: "text-primary",
      muted: "text-muted-foreground underline hover:text-foreground",
      inherit: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function TextLink({
  className,
  variant,
  render,
  ...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof textLinkVariants>) {
  return useRender({
    defaultTagName: "a",
    render,
    props: mergeProps<"a">({ className: cn(textLinkVariants({ variant }), className) }, props),
  });
}

export { TextLink, textLinkVariants };
