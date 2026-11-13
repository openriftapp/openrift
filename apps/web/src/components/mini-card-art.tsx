import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { cn } from "@/lib/utils";

// Mirrors AFTER_BORDER (a 1px inset ::after, never a border on the <img>);
// not imported because card-thumbnail.tsx pulls in the whole thumbnail stack.
const CARD_EDGE =
  "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border-card-edge after:border";

export function MiniCardArt({ url, className }: { url: string; className?: string }) {
  return (
    <span
      className={cn("relative block", CARD_EDGE, className)}
      style={{ borderRadius: CARD_BORDER_RADIUS }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        draggable={false}
        className="aspect-card block w-full rounded-[inherit] object-cover"
      />
    </span>
  );
}
