import { SimpleSelect } from "@/components/ui/simple-select";
import { useSets } from "@/features/cards/hooks/use-sets";

const ANY_SET = "__any-set";

export function SetFilterSelect({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (setSlug: string | undefined) => void;
}) {
  const { data } = useSets();
  const items = [
    { value: ANY_SET, label: "All sets" },
    ...data.sets.map((set) => ({ value: set.slug, label: `${set.slug} · ${set.name}` })),
  ];
  return (
    <SimpleSelect
      items={items}
      value={value ?? ANY_SET}
      onChange={(next) => onChange(next === ANY_SET ? undefined : next)}
      label="Set"
      className="min-w-0"
    />
  );
}
