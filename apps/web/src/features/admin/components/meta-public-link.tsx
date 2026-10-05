import { ExternalLinkIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

/** Archive pages live outside the admin shell, so this is a plain anchor, not a router `Link`. */
export function MetaPublicLinkButton({
  href,
  label,
  ariaLabel,
  mono = false,
}: {
  href: string;
  label: string;
  ariaLabel: string;
  mono?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <span className={mono ? "font-mono" : undefined}>{label}</span>
      <ExternalLinkIcon />
    </a>
  );
}
