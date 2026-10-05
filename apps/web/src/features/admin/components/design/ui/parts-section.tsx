import { CopyIcon, EllipsisVerticalIcon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLabel,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { CHAMPIONS } from "@/features/admin/components/design/demo-data";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

const GROUPS = {
  comboboxChips: { id: "parts-combobox-chips", title: "ComboboxChips" },
  inputGroupButton: { id: "parts-input-group-button", title: "InputGroupButton" },
  menuLabel: { id: "parts-menu-label", title: "Menu label & group" },
  chartTooltip: { id: "parts-chart-tooltip", title: "ChartTooltipContent" },
  navigationMenu: { id: "parts-navigation-menu", title: "NavigationMenu" },
} as const;

export const PARTS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const CHART_DATA = [
  { set: "OGN", owned: 212 },
  { set: "SFD", owned: 148 },
  { set: "UNL", owned: 96 },
];

const CHART_CONFIG = {
  owned: { label: "Owned", color: "var(--primary)" },
} satisfies ChartConfig;

function ChipsDemo() {
  const anchor = useComboboxAnchor();
  const [value, setValue] = useState<string[]>(CHAMPIONS.slice(0, 2));
  return (
    <Combobox<string, true> multiple items={CHAMPIONS} value={value} onValueChange={setValue}>
      <ComboboxChips ref={anchor} className="w-72">
        {value.map((chip) => (
          <ComboboxChip key={chip}>{chip}</ComboboxChip>
        ))}
        <ComboboxChipsInput
          aria-label="Champions"
          placeholder={value.length > 0 ? "" : "Champions"}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No champions match.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

export function PartsSection() {
  const [query, setQuery] = useState("Teemo");

  return (
    <DemoSection
      id="parts"
      title="Parts"
      note="Sub-components of the bigger primitives that a call site composes on its own."
      docs="components/ui/combobox.tsx · input-group.tsx · dropdown-menu.tsx · chart.tsx · navigation-menu.tsx"
    >
      <DemoGroup
        {...GROUPS.comboboxChips}
        hint="A multi-value field whose values show as removable chips inside the input."
      >
        <DemoRow label="Champions">
          <ChipsDemo />
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.inputGroupButton}
        hint="A button that belongs to an input goes inside the InputGroup, which locks its height to the field."
      >
        <DemoGrid>
          <Demo name="icon-xs" hint="Clear or copy inside the field.">
            <InputGroup className="w-64">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Card search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Clear" onClick={() => setQuery("")}>
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Demo>
          <Demo name="xs" hint="A labelled inline action.">
            <InputGroup className="w-64">
              <InputGroupInput aria-label="Deck code" readOnly value="RIFT-2026-OGN" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton>
                  <CopyIcon />
                  Copy
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.menuLabel}
        hint="A group of menu items under a muted uppercase label. ContextMenu has the same pair."
      >
        <DemoRow label="DropdownMenu">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Deck actions" />}
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>Deck</DropdownMenuLabel>
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuItem>Export code</DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Share</DropdownMenuLabel>
                <DropdownMenuItem>Copy link</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.chartTooltip}
        hint="The tooltip every chart renders, so a custom tooltip only supplies a formatter."
      >
        <DemoRow label="Hover a bar" className="block">
          <ChartContainer config={CHART_CONFIG} className="aspect-auto h-40 w-full max-w-md">
            <BarChart data={CHART_DATA} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis dataKey="set" tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} defaultIndex={1} />
              <Bar dataKey="owned" fill="var(--color-owned)" radius={4} />
            </BarChart>
          </ChartContainer>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.navigationMenu}
        hint="The desktop header's primary nav and its More panel. Nothing else uses it."
      >
        <DemoRow label="Header nav">
          <NavigationMenu>
            <NavigationMenuList className="gap-1">
              <NavigationMenuItem>
                <NavigationMenuLink href="#parts-navigation-menu">Cards</NavigationMenuLink>
              </NavigationMenuItem>
              <NavigationMenuItem>
                <NavigationMenuTrigger>More</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div className="w-56 p-2">
                    <NavigationMenuLabel>Play</NavigationMenuLabel>
                    <NavigationMenuLink href="#parts-navigation-menu">
                      Tournaments
                    </NavigationMenuLink>
                    <NavigationMenuLink href="#parts-navigation-menu">
                      Meta archive
                    </NavigationMenuLink>
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
