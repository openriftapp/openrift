import type { ReactNode } from "react";

import { Code } from "@/components/ui/code";
import { TextLink } from "@/components/ui/text-link";

interface MarkupProps {
  children?: ReactNode;
}

export const PROSE_MARKUP = {
  strong: ({ children }: MarkupProps) => <strong className="text-foreground">{children}</strong>,
  em: ({ children }: MarkupProps) => <em>{children}</em>,
  code: ({ children }: MarkupProps) => <Code>{children}</Code>,
};

export function linkMarkup(href: string) {
  return function LinkMarkup({ children }: MarkupProps) {
    return <TextLink href={href}>{children}</TextLink>;
  };
}
