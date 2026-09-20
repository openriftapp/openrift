import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PickerGroup, PickerList, PickerRow } from "@/components/ui/picker-list";
import { CHAMPIONS } from "@/features/admin/components/design/demo-data";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { cn } from "@/lib/utils";

const GROUPS = {
  combobox: { id: "pickers-combobox", title: "Combobox" },
  command: { id: "pickers-command", title: "Command" },
  pickerList: { id: "pickers-picker-list", title: "Picker list" },
} as const;

export const PICKERS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function PickersSection() {
  const [champions, setChampions] = useState<string[]>(["Jinx"]);
  const [highlighted, setHighlighted] = useState("");
  const [groupHighlighted, setGroupHighlighted] = useState("");
  const [searchableHighlighted, setSearchableHighlighted] = useState("");

  return (
    <DemoSection
      id="pickers"
      title="Pickers"
      note="Searchable lists that hand back one value or several."
    >
      <DemoGroup {...GROUPS.combobox}>
        <DemoRow label="Searchable multi-select">
          <Combobox<string, true>
            multiple
            items={CHAMPIONS}
            value={champions}
            onValueChange={setChampions}
          >
            <ComboboxTrigger
              render={<Button variant="outline" />}
              className={cn(
                "w-56 justify-between font-normal",
                champions.length === 0 && "text-muted-foreground",
              )}
            >
              <span className="truncate">
                {champions.length === 0 ? "Pick legends…" : champions.join(" + ")}
              </span>
            </ComboboxTrigger>
            <ComboboxContent className="w-(--anchor-width) min-w-56">
              <ComboboxInput placeholder="Search legends…" showTrigger={false} />
              <ComboboxEmpty>No matching legend.</ComboboxEmpty>
              <ComboboxList>
                {(name: string) => (
                  <ComboboxItem key={name} value={name}>
                    {name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.command}>
        <DemoRow label="Palette">
          <Command className="w-full max-w-64 rounded-lg border">
            <CommandInput placeholder="Quick add…" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup heading="Cards">
                {CHAMPIONS.slice(0, 3).map((name) => (
                  <CommandItem key={name} onSelect={() => toast(`Added ${name}`)}>
                    {name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.pickerList}>
        <DemoGrid>
          <Demo name="PickerList" hint="Keyboard-navigable row list for popovers (arrows + Enter).">
            <div className="w-full max-w-56 rounded-lg border">
              <PickerList highlightedId={highlighted} onHighlightChange={setHighlighted}>
                {CHAMPIONS.slice(0, 3).map((name) => (
                  <PickerRow key={name} value={name} onSelect={() => toast(`Picked ${name}`)}>
                    {name}
                  </PickerRow>
                ))}
              </PickerList>
            </div>
          </Demo>
          <Demo
            name="PickerGroup"
            hint="Labels a band of rows, and keyboard nav skips the heading."
          >
            <div className="w-full max-w-56 rounded-lg border">
              <PickerList highlightedId={groupHighlighted} onHighlightChange={setGroupHighlighted}>
                <PickerGroup label="Binder A">
                  {CHAMPIONS.slice(0, 2).map((name) => (
                    <PickerRow key={name} value={name} onSelect={() => toast(`Picked ${name}`)}>
                      {name}
                    </PickerRow>
                  ))}
                </PickerGroup>
                <PickerGroup label="Shoebox">
                  {CHAMPIONS.slice(2, 4).map((name) => (
                    <PickerRow key={name} value={name} onSelect={() => toast(`Picked ${name}`)}>
                      {name}
                    </PickerRow>
                  ))}
                </PickerGroup>
              </PickerList>
            </div>
          </Demo>
          <Demo
            name="PickerList (searchable)"
            hint="Every row needs keywords, or the filter cannot find it."
          >
            <div className="w-full max-w-56 rounded-lg border">
              <PickerList
                searchPlaceholder="Filter legends…"
                highlightedId={searchableHighlighted}
                onHighlightChange={setSearchableHighlighted}
              >
                <CommandEmpty>No matching legend.</CommandEmpty>
                {CHAMPIONS.map((name) => (
                  <PickerRow
                    key={name}
                    value={name}
                    keywords={[name]}
                    onSelect={() => toast(`Picked ${name}`)}
                  >
                    {name}
                  </PickerRow>
                ))}
              </PickerList>
            </div>
          </Demo>
        </DemoGrid>
      </DemoGroup>
    </DemoSection>
  );
}
