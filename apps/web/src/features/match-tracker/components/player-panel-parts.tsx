import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const MAX_PIP_TARGET = 12;

export const PANEL_VIGNETTE_STYLE = {
  backgroundImage: "radial-gradient(120% 80% at 50% 50%, transparent 34%, var(--color-card) 100%)",
  opacity: 0.7,
};

export function TargetProgress({ points, target }: { points: number; target: number }) {
  if (target > MAX_PIP_TARGET) {
    return (
      <span className="text-muted-foreground text-2xs">
        {m.tracker_panel_of_target({ target })}
      </span>
    );
  }
  return (
    <span className="flex gap-0.5" aria-label={m.tracker_panel_points_progress({ points, target })}>
      {Array.from({ length: target }, (_, index) => (
        <i
          key={index}
          className={cn(
            "h-0.5 w-2 rounded-full",
            index < points ? "bg-primary" : "bg-foreground/15",
          )}
        />
      ))}
    </span>
  );
}
