import type { ComponentProps } from "react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * The button that opens an inline editor. The editor replaces it while open, so closing the
 * editor remounts it; `takeFocus` answers whether the close asked for the focus back.
 */
export function EditorOpenerButton({
  takeFocus,
  ...props
}: ComponentProps<typeof Button> & { takeFocus: () => boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (takeFocus()) {
      ref.current?.focus();
    }
  }, [takeFocus]);
  return <Button ref={ref} {...props} />;
}
