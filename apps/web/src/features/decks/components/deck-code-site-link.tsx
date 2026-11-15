import type { ReactNode } from "react";

import { TextLink } from "@/components/ui/text-link";

const DECK_CODE_SITE_URL = "https://piltoverarchive.com";

export function DeckCodeSiteLink({ children }: { children: ReactNode }) {
  return (
    <TextLink variant="muted" href={DECK_CODE_SITE_URL} target="_blank" rel="noreferrer">
      {children}
    </TextLink>
  );
}
