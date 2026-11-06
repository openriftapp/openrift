import type { ReactNode } from "react";
import { createContext, use } from "react";

import { isPlainPrimaryClick } from "@/features/cards/lib/card-row-interactions";

export type CardPageHrefResolver = (
  cardId: string,
  printingId: string | null,
) => string | undefined;

export const CardPageHrefContext = createContext<CardPageHrefResolver | undefined>(undefined);

export function DeckCardPageLink({
  cardId,
  printingId,
  className,
  children,
}: {
  cardId: string;
  printingId: string | null;
  className?: string;
  children: ReactNode;
}) {
  const resolveHref = use(CardPageHrefContext);
  const href = resolveHref?.(cardId, printingId);
  if (href === undefined) {
    return children;
  }
  return (
    <a
      href={href}
      tabIndex={-1}
      draggable={false}
      className={className}
      onClick={(event) => {
        if (isPlainPrimaryClick(event)) {
          event.preventDefault();
        } else {
          event.stopPropagation();
        }
      }}
    >
      {children}
    </a>
  );
}
