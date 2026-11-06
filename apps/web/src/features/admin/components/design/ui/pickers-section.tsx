import { CheckIcon, FolderIcon, HeartIcon, SwordsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ComboboxPicker } from "@/components/combobox-picker";
import type { ComboboxPickerOption } from "@/components/combobox-picker";
import type { PickerOption } from "@/components/picker-dialog";
import { PickerDialog, PickerSection } from "@/components/picker-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PickerGroup, PickerList, PickerRow } from "@/components/ui/picker-list";
import {
  ResponsiveDialog,
  ResponsiveDialogCancel,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import { SELECT_NONE, SimpleSelect } from "@/components/ui/simple-select";
import type { SimpleSelectItem } from "@/components/ui/simple-select";
import { CHAMPIONS, LEGENDS, SETS } from "@/features/admin/components/design/demo-data";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

const GROUPS = {
  select: { id: "pickers-select", title: "SimpleSelect" },
  combobox: { id: "pickers-combobox", title: "ComboboxPicker" },
  pickerList: { id: "pickers-picker-list", title: "PickerList & PickerDialog" },
  responsive: { id: "pickers-responsive", title: "Responsive pickers" },
  command: { id: "pickers-command", title: "Command" },
} as const;

export const PICKERS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const SET_ITEMS: SimpleSelectItem[] = [
  { value: "all", label: "All sets" },
  ...SETS.map((set) => ({ value: set.value, label: set.label })),
];

function listName(options: readonly PickerOption[], value: string): string {
  const label = options.find((option) => option.value === value)?.label;
  return typeof label === "string" ? label : value;
}

const SET_COUNT_ITEMS: SimpleSelectItem[] = [
  { value: "ogn", label: "Origins", detail: 412 },
  { value: "sfd", label: "Spiritforged", detail: 186 },
  { value: "unl", label: "Unleashed", detail: 0, disabled: true },
];

const SET_CODE_ITEMS: SimpleSelectItem[] = [
  { value: SELECT_NONE, label: "No set" },
  ...SETS.map((set) => ({ value: set.value, label: set.label, detail: set.code })),
];

const SET_OPTIONS: ComboboxPickerOption[] = SETS.map((set) => ({
  value: set.value,
  label: set.label,
  prefix: set.code,
  keywords: set.code,
}));

const LEGEND_OPTIONS: ComboboxPickerOption[] = LEGENDS.map((name) => ({
  value: name,
  label: name,
}));

const LIST_OPTIONS: ComboboxPickerOption[] = [
  { value: "binder", label: "Main binder", group: "collections", icon: <FolderIcon />, count: 412 },
  { value: "shoebox", label: "Shoebox", group: "collections", icon: <FolderIcon />, count: 96 },
  {
    value: "loaners",
    label: "Loaners",
    group: "collections",
    icon: <FolderIcon />,
    count: 0,
    muted: true,
  },
  { value: "wanted", label: "Wanted", group: "wishlists", icon: <HeartIcon />, count: 23 },
  {
    value: "foils",
    label: "Foil upgrades",
    group: "wishlists",
    icon: <HeartIcon />,
    count: 7,
    belowDivider: true,
  },
];

const LIST_GROUP_LABELS = new Map([
  ["collections", "Collections"],
  ["wishlists", "Wishlists"],
]);

const EVENT_SUGGESTIONS: ComboboxPickerOption[] = [
  "Summoner Skirmish",
  "Nexus Night",
  "Regional Qualifier",
].map((name) => ({ value: name, label: name }));

const SEARCH_MIN = 2;

function searchLegends(query: string): ComboboxPickerOption[] {
  const needle = query.trim().toLowerCase();
  return LEGEND_OPTIONS.filter((option) => option.label.toLowerCase().includes(needle));
}

const DIALOG_LISTS: PickerOption[] = [
  { value: "binder", label: "Main binder", group: "collections", meta: "412 cards" },
  { value: "shoebox", label: "Shoebox", group: "collections", meta: "96 cards" },
  { value: "wanted", label: "Wanted", group: "wishlists", meta: "23 cards" },
  { value: "trade", label: "Trade binder", group: "wishlists", meta: "Full", disabled: true },
];

const DIALOG_GROUPS = [
  { key: "collections", label: "Collections" },
  { key: "wishlists", label: "Wishlists" },
];

export function PickersSection() {
  return (
    <DemoSection
      id="pickers"
      title="Pickers"
      note="SimpleSelect for a static list of up to about 10 options without search. Radio or a segmented toggle group for a short choice that stays visible. ComboboxPicker for search, several picks, server data or a create row. PickerList and PickerDialog for a list placed directly in a dialog or popover with its own keyboard handling. ResponsivePopover for long lists on phones. Admin wrappers (LanguageSelect, SetPicker, DatePrecisionControl) live in Patterns › Admin pickers."
    >
      <SelectGroup />
      <ComboboxGroup />
      <PickerListGroup />
      <ResponsiveGroup />
      <CommandGroupDemo />
    </DemoSection>
  );
}

function SelectGroup() {
  const [set, setSet] = useState("all");
  const [countSet, setCountSet] = useState("ogn");
  const [codeSet, setCodeSet] = useState<string>(SELECT_NONE);

  return (
    <DemoGroup
      {...GROUPS.select}
      hint="A static list of up to about 10 options, no search. The first option is the off state."
    >
      <SwatchRow label="Sizes">
        <Swatch label="sm">
          <SimpleSelect
            items={SET_ITEMS}
            value={set}
            onChange={setSet}
            label="Set, small"
            size="sm"
            className="w-36"
          />
        </Swatch>
        <Swatch label="default">
          <SimpleSelect
            items={SET_ITEMS}
            value={set}
            onChange={setSet}
            label="Set"
            className="w-40"
          />
        </Swatch>
      </SwatchRow>
      <SwatchRow label="Rows">
        <Swatch label="detail as count, disabled row">
          <SimpleSelect
            items={SET_COUNT_ITEMS}
            value={countSet}
            onChange={setCountSet}
            label="Set with owned counts"
            className="w-44"
          />
        </Swatch>
        <Swatch label="renderValue, SELECT_NONE">
          <SimpleSelect
            items={SET_CODE_ITEMS}
            value={codeSet}
            onChange={setCodeSet}
            label="Set with code"
            className="w-44"
            renderValue={(item) =>
              item.value === SELECT_NONE ? (
                <span className="text-muted-foreground">{item.label}</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-xs">{item.detail}</span>
                  {item.label}
                </span>
              )
            }
          />
        </Swatch>
      </SwatchRow>
    </DemoGroup>
  );
}

function ComboboxGroup() {
  const [set, setSet] = useState<string | null>("ogn");
  const [legends, setLegends] = useState<string[]>(["Jinx", "Lee Sin"]);
  const [inputLegend, setInputLegend] = useState<string | null>(null);
  const [chipSets, setChipSets] = useState<string[]>(["sfd"]);
  const [menuSets, setMenuSets] = useState<string[]>([]);
  const [list, setList] = useState<string | null>("binder");
  const [query, setQuery] = useState("");
  const [settledQuery, setSettledQuery] = useState("");
  const [results, setResults] = useState<ComboboxPickerOption[]>([]);
  const [serverLegend, setServerLegend] = useState<string | null>(null);
  const [tagOptions, setTagOptions] = useState<ComboboxPickerOption[]>([
    { value: "aggro", label: "Aggro" },
    { value: "control", label: "Control" },
  ]);
  const [tags, setTags] = useState<string[]>(["aggro"]);
  const [inlineSet, setInlineSet] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>("Summoner Skirmish");

  const searching = query.trim().length >= SEARCH_MIN;
  useEffect(() => {
    if (!searching) {
      return;
    }
    const timer = setTimeout(() => {
      setResults(searchLegends(query));
      setSettledQuery(query);
    }, 600);
    return () => clearTimeout(timer);
  }, [query, searching]);

  const createTag = (name: string) => {
    const value = name.trim().toLowerCase();
    setTagOptions((prev) => [...prev, { value, label: name.trim() }]);
    setTags((prev) => [...prev, value]);
  };

  return (
    <DemoGroup
      {...GROUPS.combobox}
      hint="Search, several picks, server data or a create row. Multi-select summaries join labels with commas."
    >
      <DemoGrid>
        <Demo name='trigger="button"' hint="Control button with a search field in the popup.">
          <ComboboxPicker
            options={SET_OPTIONS}
            value={set}
            onChange={setSet}
            placeholder="Pick a set"
            searchPlaceholder="Search sets…"
            emptyText="No matching set."
            aria-label="Set"
            className="w-48"
          />
        </Demo>
        <Demo name="button + multiple" hint="Rows toggle and the popup stays open.">
          <ComboboxPicker
            multiple
            options={LEGEND_OPTIONS}
            value={legends}
            onChange={setLegends}
            placeholder="Pick legends"
            searchPlaceholder="Search legends…"
            emptyText="No matching legend."
            triggerIcon={<SwordsIcon className="text-muted-foreground" />}
            aria-label="Legends"
            className="w-56"
          />
        </Demo>
        <Demo name='trigger="input"' hint="The input is the trigger and filters as you type.">
          <ComboboxPicker
            trigger="input"
            options={LEGEND_OPTIONS}
            value={inputLegend}
            onChange={setInputLegend}
            placeholder="Search legends…"
            emptyText="No matching legend."
            clearable
            aria-label="Legend"
            className="w-56"
          />
        </Demo>
        <Demo
          name='trigger="chip"'
          hint="Badge trigger for filter bars, filled while anything is set."
        >
          <ComboboxPicker
            trigger="chip"
            multiple
            options={SET_OPTIONS}
            value={chipSets}
            onChange={setChipSets}
            placeholder="Set"
            searchPlaceholder="Search sets…"
            emptyText="No matching set."
            aria-label="Set filter"
          />
        </Demo>
        <Demo name='trigger="menu"' hint="A row inside a menu that opens a submenu-style list.">
          <div className="bg-popover w-56 rounded-lg border p-1">
            <ComboboxPicker
              trigger="menu"
              multiple
              options={SET_OPTIONS}
              value={menuSets}
              onChange={setMenuSets}
              placeholder="Sets"
              searchPlaceholder="Search sets…"
              emptyText="No matching set."
              containKeys
              aria-label="Sets"
            />
          </div>
        </Demo>
        <Demo
          name="groups, icons, counts"
          hint="group + groupLabels head sections, belowDivider splits a section, muted dims a row."
        >
          <ComboboxPicker
            options={LIST_OPTIONS}
            value={list}
            onChange={setList}
            groupLabels={LIST_GROUP_LABELS}
            placeholder="Pick a list"
            searchPlaceholder="Search lists…"
            emptyText="No matching list."
            aria-label="Destination list"
            className="w-48"
          />
        </Demo>
        <Demo
          name='filter="none" (server search)'
          hint="Hint until two letters, skeleton rows while loading, empty text when nothing matches."
        >
          <ComboboxPicker
            trigger="input"
            filter="none"
            options={searching ? results : []}
            selectedOptions={
              serverLegend === null ? [] : [{ value: serverLegend, label: serverLegend }]
            }
            value={serverLegend}
            onChange={setServerLegend}
            query={query}
            onQueryChange={setQuery}
            hint={searching ? undefined : `Type ${SEARCH_MIN} letters to search`}
            loading={searching && settledQuery !== query}
            loadingText="Searching…"
            emptyText="No legend matches."
            openOnFocus
            placeholder="Search legends…"
            aria-label="Legend, server search"
            className="w-56"
          />
        </Demo>
        <Demo name="actions" hint="A create row below the options runs with the typed query.">
          <ComboboxPicker
            multiple
            options={tagOptions}
            value={tags}
            onChange={setTags}
            placeholder="Add tags"
            searchPlaceholder="Search or create…"
            emptyText="No matching tag."
            actions={[
              {
                key: "create",
                label: (q) => `Create “${q.trim()}”`,
                onSelect: createTag,
                visible: (q) =>
                  q.trim() !== "" &&
                  !tagOptions.some((tag) => tag.label.toLowerCase() === q.trim().toLowerCase()),
              },
            ]}
            aria-label="Deck tags"
            className="w-56"
          />
        </Demo>
        <Demo name="inline" hint="Input mode with the list always open below it, for dialogs.">
          <div className="w-full max-w-56">
            <ComboboxPicker
              trigger="input"
              inline
              options={SET_OPTIONS}
              value={inlineSet}
              onChange={setInlineSet}
              placeholder="Search sets…"
              emptyText="No matching set."
              aria-label="Set, inline"
            />
          </div>
        </Demo>
        <Demo name="freeText" hint="The typed text is the value and options are suggestions.">
          <ComboboxPicker
            trigger="input"
            freeText
            options={EVENT_SUGGESTIONS}
            value={eventName}
            onChange={setEventName}
            createLabel={(text) => `Use “${text}”`}
            placeholder="Event name"
            emptyText="No suggestion."
            aria-label="Event name"
            className="w-56"
          />
        </Demo>
      </DemoGrid>
    </DemoGroup>
  );
}

function PickerListGroup() {
  const [highlighted, setHighlighted] = useState("");
  const [groupHighlighted, setGroupHighlighted] = useState("");
  const [searchHighlighted, setSearchHighlighted] = useState("");
  const [stateHighlighted, setStateHighlighted] = useState("");
  const [picked, setPicked] = useState("Jinx");
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [lists, setLists] = useState(DIALOG_LISTS);

  return (
    <DemoGroup
      {...GROUPS.pickerList}
      hint="A list placed directly in a dialog or popover. Arrows move, Enter picks, and the host keeps its own shortcuts."
    >
      <DemoGrid>
        <Demo name="PickerList" hint="Keyboard-navigable rows (arrows + Enter).">
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
        <Demo name="PickerGroup" hint="Labels a band of rows, and keyboard nav skips the heading.">
          <div className="w-full max-w-56 rounded-lg border">
            <PickerList highlightedId={groupHighlighted} onHighlightChange={setGroupHighlighted}>
              <PickerGroup label="Main binder">
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
              highlightedId={searchHighlighted}
              onHighlightChange={setSearchHighlighted}
            >
              <CommandEmpty>No matching legend.</CommandEmpty>
              {LEGENDS.slice(0, 8).map((name) => (
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
        <Demo name="PickerRow states" hint="selected tints the row, disabled skips it.">
          <div className="w-full max-w-56 rounded-lg border">
            <PickerList highlightedId={stateHighlighted} onHighlightChange={setStateHighlighted}>
              {["Jinx", "Lee Sin", "Viktor"].map((name) => (
                <PickerRow
                  key={name}
                  value={name}
                  selected={picked === name}
                  disabled={name === "Viktor"}
                  onSelect={() => setPicked(name)}
                >
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {picked === name && <CheckIcon className="size-4 shrink-0" />}
                </PickerRow>
              ))}
            </PickerList>
          </div>
        </Demo>
        <Demo
          name="PickerDialog"
          hint="Row picks act at once. Search, groups, a disabled row and a create row."
        >
          <Button variant="outline" onClick={() => setAddOpen(true)}>
            Add to list
          </Button>
        </Demo>
        <Demo name="PickerDialog (confirm)" hint="A row selects, and the confirm button acts.">
          <Button variant="outline" onClick={() => setMoveOpen(true)}>
            Move 3 cards
          </Button>
        </Demo>
      </DemoGrid>

      <PickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Jinx to a list"
        description="Pick a collection or wishlist."
        options={lists}
        groups={DIALOG_GROUPS}
        searchPlaceholder="Search lists…"
        noMatchesText="No matching list."
        emptyText="No lists yet."
        onPick={(value) => {
          setAddOpen(false);
          toast(`Added to ${listName(lists, value)}`);
        }}
        create={{
          actions: [
            { key: "collections", label: "New collection", placeholder: "Collection name" },
            { key: "wishlists", label: "New wishlist", placeholder: "Wishlist name" },
          ],
          onCreate: (key, name, done) => {
            setLists((prev) => [...prev, { value: `${key}-${name}`, label: name, group: key }]);
            done();
          },
        }}
      />
      <PickerDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title="Move 3 cards"
        options={DIALOG_LISTS.filter((option) => option.group === "collections")}
        emptyText="No collections yet."
        confirm={{
          label: "Move",
          pendingLabel: "Moving…",
          onConfirm: (value) => {
            setMoveOpen(false);
            toast(`Moved to ${listName(DIALOG_LISTS, value)} (demo only)`);
          },
        }}
      />
    </DemoGroup>
  );
}

function ResponsiveGroup() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [highlighted, setHighlighted] = useState("");
  const [legend, setLegend] = useState("Lee Sin");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLegend, setDialogLegend] = useState<string | null>("Jinx");

  return (
    <DemoGroup
      {...GROUPS.responsive}
      hint="A popover or dialog from md up, a bottom drawer below it. Resize under 768px to see the drawer."
    >
      <DemoGrid>
        <Demo name="ResponsivePopover" hint="A long PickerList that turns into a drawer on phones.">
          <ResponsivePopover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <ResponsivePopoverTrigger render={<Button variant="control" className="w-48" />}>
              {legend}
            </ResponsivePopoverTrigger>
            <ResponsivePopoverContent title="Pick a legend" hideTitle>
              <PickerList
                searchPlaceholder="Search legends…"
                highlightedId={highlighted}
                onHighlightChange={setHighlighted}
              >
                <CommandEmpty>No matching legend.</CommandEmpty>
                {LEGENDS.map((name) => (
                  <PickerRow
                    key={name}
                    value={name}
                    keywords={[name]}
                    selected={legend === name}
                    onSelect={() => {
                      setLegend(name);
                      setPopoverOpen(false);
                    }}
                  >
                    {name}
                  </PickerRow>
                ))}
              </PickerList>
            </ResponsivePopoverContent>
          </ResponsivePopover>
        </Demo>
        <Demo
          name="ResponsiveDialog + PickerSection"
          hint="A picker that needs a title and footer on both layouts."
        >
          <Button variant="outline" onClick={() => setDialogOpen(true)}>
            Choose a legend
          </Button>
        </Demo>
      </DemoGrid>

      <ResponsiveDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Choose a legend</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              The deck is built around this legend.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <PickerSection
            options={LEGENDS.map((name) => ({ value: name, label: name, keywords: [name] }))}
            selected={dialogLegend}
            onPick={setDialogLegend}
            searchPlaceholder="Search legends…"
            noMatchesText="No matching legend."
            emptyText="No legends."
          />
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel />
            <Button
              disabled={dialogLegend === null}
              onClick={() => {
                setDialogOpen(false);
                toast(`Built around ${dialogLegend} (demo only)`);
              }}
            >
              Choose
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </DemoGroup>
  );
}

function CommandGroupDemo() {
  return (
    <DemoGroup
      {...GROUPS.command}
      hint="The cmdk layer under PickerList. Used bare only for action palettes."
    >
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
  );
}
