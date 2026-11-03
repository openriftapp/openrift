import { createContext, use, useEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";

interface PrintingsHost {
  slot: HTMLElement | null;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

const PrintingsHostContext = createContext<PrintingsHost | null>(null);

/** The surface the all-printings view grows into, or null to open it as a full-screen dialog. */
export function usePrintingsHost(): PrintingsHost | null {
  return use(PrintingsHostContext);
}

/** Expanding scrolls `scrollerRef`, or else the slot's parent, to the top. */
export function usePrintingsHostState(scrollerRef?: RefObject<HTMLElement | null>) {
  const [expanded, setExpanded] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (expanded) {
      (scrollerRef?.current ?? slot?.parentElement)?.scrollTo({ top: 0 });
    }
  }, [expanded, slot, scrollerRef]);

  return { expanded, host: { slot, expanded, setExpanded }, slotRef: setSlot };
}

export function PrintingsHostProvider({
  host,
  children,
}: {
  host: PrintingsHost;
  children: ReactNode;
}) {
  return <PrintingsHostContext value={host}>{children}</PrintingsHostContext>;
}
