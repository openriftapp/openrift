import type { ReactNode } from "react";

import { Kbd as UiKbd } from "@/components/ui/kbd";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <UiKbd className="pointer-events-none border border-current bg-transparent font-mono leading-none text-inherit opacity-70">
      {children}
    </UiKbd>
  );
}
