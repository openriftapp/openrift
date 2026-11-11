import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useScrolledPast } from "@/hooks/use-scrolled-past";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ScrollToTopButton({
  threshold = 800,
  className,
}: {
  threshold?: number;
  className?: string;
}) {
  const visible = useScrolledPast(threshold);
  return (
    <Button
      variant="glass-pill"
      size="icon-lg"
      aria-label={m.common_scroll_to_top()}
      aria-hidden={!visible}
      tabIndex={visible ? undefined : -1}
      onClick={() => {
        const reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
        globalThis.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      }}
      className={cn(
        "fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-30 transition-opacity",
        !visible && "pointer-events-none opacity-0",
        className,
      )}
    >
      <ArrowUpIcon />
    </Button>
  );
}
