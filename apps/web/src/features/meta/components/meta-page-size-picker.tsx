import { META_PAGE_SIZES } from "@openrift/shared/meta-query";

import { SimpleSelect } from "@/components/ui/simple-select";
import type { MetaPageSize } from "@/features/meta/lib/meta-paging";
import { META_PAGE_ALL } from "@/features/meta/lib/meta-paging";

export function MetaPageSizePicker<TSize extends MetaPageSize>({
  value,
  isDefault,
  total,
  allLabel,
  itemLabel,
  ariaLabel,
  onChange,
}: {
  value: TSize;
  isDefault: boolean;
  total: number;
  allLabel?: string;
  itemLabel: (size: string) => string;
  ariaLabel: string;
  onChange: (value: TSize) => void;
}) {
  if (total <= META_PAGE_SIZES[0] && isDefault) {
    return null;
  }
  const shown: Record<string, string> = Object.fromEntries(
    META_PAGE_SIZES.map((size) => [String(size), String(size)]),
  );
  if (allLabel !== undefined) {
    shown[META_PAGE_ALL] = allLabel;
  }
  return (
    <SimpleSelect
      items={Object.entries(shown).map(([key, label]) => ({ value: key, label: itemLabel(label) }))}
      value={String(value)}
      onChange={(picked) =>
        onChange((picked === META_PAGE_ALL ? META_PAGE_ALL : Number(picked)) as TSize)
      }
      label={ariaLabel}
      renderValue={(item) => shown[item.value]}
      className="w-36"
    />
  );
}
