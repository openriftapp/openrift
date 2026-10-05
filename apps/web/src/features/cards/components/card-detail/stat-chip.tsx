import { CardIcon } from "@/components/card-icon";

export function StatChip({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: string;
}) {
  return (
    <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold">
      {icon && <CardIcon src={icon} className="size-3.5" />}
      <span className="text-muted-foreground text-xs font-normal">{label}</span>
      {value}
    </span>
  );
}
