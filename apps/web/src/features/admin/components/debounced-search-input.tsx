import { SearchInput } from "@/components/search-input";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";

// State lives here, not lifted, so each keystroke re-renders only this input
// and not the parent table with its potentially thousands of rows.
export function DebouncedSearchInput({
  urlValue,
  onCommit,
  placeholder,
  className,
}: {
  urlValue: string;
  onCommit: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [searchInput, setSearchInput] = useSearchUrlSync({ urlValue, onCommit });
  return (
    <SearchInput
      value={searchInput}
      onValueChange={setSearchInput}
      placeholder={placeholder}
      className={className}
    />
  );
}
