import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useSearchUrlSync } from "@/features/cards/hooks/use-search-url-sync";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function MetaArchiveSearch({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
}) {
  const [typed, setTyped] = useSearchUrlSync({ urlValue: value, onCommit });

  return (
    <div className={cn("relative min-w-52 flex-1", className)}>
      <SearchIcon
        aria-hidden
        className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        type="search"
        aria-label={m.meta_search_aria()}
        placeholder={m.meta_search_placeholder()}
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="pl-8"
      />
    </div>
  );
}
