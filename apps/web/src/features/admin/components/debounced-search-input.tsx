import { SearchInput } from "@/components/search-input";
import { useSearchUrlSync } from "@/hooks/use-search-url-sync";

/** State must stay local: lifting it re-renders the parent table, with up to thousands of rows, per keystroke. */
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
