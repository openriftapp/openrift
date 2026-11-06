import { cn } from "@/lib/utils";

export function CardQuantityChip({
  quantity,
  title,
  className,
}: {
  quantity: number;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "border-gilt text-gilt bg-background absolute right-2 bottom-2 z-20 flex h-9 min-w-9 items-center justify-center rounded-full border-2 px-2.5 text-lg leading-none font-bold tabular-nums shadow-md",
        className,
      )}
    >
      ×{quantity}
    </span>
  );
}
