import { Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils"; // custom: the scaffold's `cn` import path does not resolve here
import { m } from "@/paraglide/messages.js"; // custom: localized accessible name

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={m.ui_spinner_loading()} // custom: localized accessible name
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
