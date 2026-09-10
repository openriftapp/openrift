import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function CompareToolbar({
  differencesOnly,
  onDifferencesOnlyChange,
  uncheckedOnly,
  onUncheckedOnlyChange,
  differences,
}: {
  differencesOnly: boolean;
  onDifferencesOnlyChange: (next: boolean) => void;
  uncheckedOnly: boolean;
  onUncheckedOnlyChange: (next: boolean) => void;
  differences: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label="Fields shown"
        value={[differencesOnly ? "differences" : "all-fields"]}
        onValueChange={([next]) => {
          if (next === "differences" || next === "all-fields") {
            onDifferencesOnlyChange(next === "differences");
          }
        }}
      >
        <ToggleGroupItem value="differences">Differences only</ToggleGroupItem>
        <ToggleGroupItem value="all-fields">All fields</ToggleGroupItem>
      </ToggleGroup>

      <ToggleGroup
        variant="outline"
        spacing={0}
        aria-label="Sources shown"
        value={[uncheckedOnly ? "unchecked" : "all-sources"]}
        onValueChange={([next]) => {
          if (next === "unchecked" || next === "all-sources") {
            onUncheckedOnlyChange(next === "unchecked");
          }
        }}
      >
        <ToggleGroupItem value="all-sources">All sources</ToggleGroupItem>
        <ToggleGroupItem value="unchecked">Unchecked</ToggleGroupItem>
      </ToggleGroup>

      <p className="text-muted-foreground text-sm">
        {differences} difference{differences === 1 ? "" : "s"}
      </p>
    </div>
  );
}
