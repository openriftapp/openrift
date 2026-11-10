import { Badge } from "@/components/ui/badge";

export function NavCountBadge({
  id,
  count,
  label,
  className,
}: {
  id?: string;
  count: number;
  label?: string;
  className?: string;
}) {
  return (
    <Badge id={id} variant="count" aria-label={label} className={className}>
      {count > 9 ? "9+" : count}
    </Badge>
  );
}
