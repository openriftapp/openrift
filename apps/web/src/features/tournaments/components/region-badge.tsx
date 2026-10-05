import { Badge } from "@/components/ui/badge";
import { useRegionLabel } from "@/features/tournaments/hooks/use-region-label";
import { cn } from "@/lib/utils";

export function RegionBadge({ region, className }: { region: string; className?: string }) {
  const regionLabel = useRegionLabel();
  return (
    <Badge variant="outline" className={cn("shrink-0", className)}>
      {regionLabel(region)}
    </Badge>
  );
}
