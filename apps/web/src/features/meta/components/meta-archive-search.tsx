import { SearchInput } from "@/components/search-input";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";
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
    <SearchInput
      className={cn("min-w-52 flex-1", className)}
      aria-label={m.meta_search_aria()}
      placeholder={m.meta_search_placeholder()}
      value={typed}
      onValueChange={setTyped}
    />
  );
}
