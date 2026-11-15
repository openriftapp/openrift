import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export type HeadingLevel = 1 | 2 | 3;
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

const HEADING_STYLES: Record<HeadingLevel, string> = {
  1: "font-heading text-2xl font-bold",
  2: "font-heading text-lg font-semibold",
  3: "text-base font-medium",
};

type HeadingProps = Omit<ComponentProps<"h1">, "ref"> & {
  level?: HeadingLevel;
  as?: HeadingTag;
};

export function Heading({ level = 2, as, className, children, ...props }: HeadingProps) {
  const Tag: HeadingTag = as ?? (`h${level}` as HeadingTag);
  return (
    <Tag data-slot="heading" className={cn(HEADING_STYLES[level], className)} {...props}>
      {children}
    </Tag>
  );
}

const EYEBROW_STYLES = {
  default: "text-muted-foreground",
  kicker: "text-primary font-heading text-sm",
  gold: "text-border-accent text-2xs",
} as const;

type EyebrowVariant = keyof typeof EYEBROW_STYLES;

export function eyebrowClass(variant: EyebrowVariant): string {
  return cn("font-semibold tracking-wide uppercase", EYEBROW_STYLES[variant]);
}

/** Use `as="span"` where the label is not a heading. */
export function Eyebrow({
  variant = "default",
  as: Tag = "h4",
  className,
  children,
  ...props
}: ComponentProps<"h4"> & {
  variant?: EyebrowVariant;
  as?: "h4" | "p" | "span";
}) {
  return (
    <Tag data-slot="eyebrow" className={cn(eyebrowClass(variant), className)} {...props}>
      {children}
    </Tag>
  );
}
