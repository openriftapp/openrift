import type { ReactNode } from "react";
import { useId } from "react";

import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

function RadioOptionRow({
  value,
  title,
  description,
  meta,
  id,
  disabled,
  className,
}: {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <label
      htmlFor={inputId}
      data-slot="radio-option-row"
      className={cn(
        "hover:bg-muted/50 flex cursor-pointer gap-3 rounded-md px-2 py-2",
        description ? "items-start" : "items-center",
        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
        className,
      )}
    >
      <RadioGroupItem
        id={inputId}
        value={value}
        disabled={disabled}
        className={description ? "mt-0.5" : undefined}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium">{title}</span>
        {description ? <span className="text-muted-foreground text-sm">{description}</span> : null}
      </span>
      {meta ? <span className="flex shrink-0 items-center gap-2">{meta}</span> : null}
    </label>
  );
}

export { RadioOptionRow };
