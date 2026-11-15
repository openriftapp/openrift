import {
  CopyIcon,
  HeartIcon,
  LayoutGridIcon,
  ListIcon,
  SquareIcon,
  SquareStackIcon,
} from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { IconToggleOption } from "@/components/ui/icon-toggle-group";
import { IconToggleGroup } from "@/components/ui/icon-toggle-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
  Matrix,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

import { SurfaceProbe } from "./surface-probe";

const TOGGLE_SIZES = ["sm", "default", "lg"] as const;

interface ChoiceState {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  invalid?: boolean;
}

const CHOICE_STATES: ChoiceState[] = [
  { label: "rest" },
  { label: "checked", checked: true },
  { label: "disabled", disabled: true },
  { label: "checked + disabled", checked: true, disabled: true },
  { label: "invalid", invalid: true },
];

interface ToggleState {
  label: string;
  props: { defaultPressed?: boolean; disabled?: boolean };
}

const TOGGLE_STATES: ToggleState[] = [
  { label: "rest", props: {} },
  { label: "pressed", props: { defaultPressed: true } },
  { label: "disabled", props: { disabled: true } },
  { label: "pressed + disabled", props: { defaultPressed: true, disabled: true } },
];

type DisplayMode = "grid" | "list";
type ViewMode = "cards" | "printings" | "copies";

const DISPLAY_OPTIONS: readonly IconToggleOption<DisplayMode>[] = [
  {
    value: "grid",
    icon: LayoutGridIcon,
    label: "Grid",
    title: "Grid view",
    ariaLabel: "Grid view",
  },
  { value: "list", icon: ListIcon, label: "List", title: "List view", ariaLabel: "List view" },
];

const VIEW_OPTIONS: readonly IconToggleOption<ViewMode>[] = [
  { value: "cards", icon: SquareIcon, label: "Cards", title: "One tile per card" },
  { value: "printings", icon: CopyIcon, label: "Printings", title: "One tile per printing" },
  { value: "copies", icon: SquareStackIcon, label: "Copies", title: "One tile per owned copy" },
];

const GROUPS = {
  states: { id: "choice-states", title: "Checkbox, radio & switch" },
  toggle: { id: "choice-toggle", title: "Toggle" },
  group: { id: "choice-group", title: "Toggle group" },
  iconGroup: { id: "choice-icon-group", title: "Icon toggle group" },
} as const;

export const CHOICE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function ChoiceSection() {
  const [view, setView] = useState("grid");
  const [display, setDisplay] = useState<DisplayMode>("grid");
  const [tileView, setTileView] = useState<ViewMode>("cards");

  return (
    <DemoSection
      id="choice"
      title="Choice"
      note="Controls that pick between fixed options rather than take a typed value."
      docs="docs/design-language.md → The control surface"
    >
      <SurfaceProbe>
        <DemoGroup {...GROUPS.states}>
          <Matrix<ChoiceState>
            label="States"
            hint="Checked is the last state in the app that still paints a solid primary fill."
            states={CHOICE_STATES}
            rows={[
              {
                label: "Checkbox",
                render: (state) => (
                  <Checkbox
                    defaultChecked={state.checked}
                    disabled={state.disabled}
                    aria-invalid={state.invalid}
                    aria-label={`Foils only, ${state.label}`}
                  />
                ),
              },
              {
                label: "Radio",
                render: (state) => (
                  <RadioGroup
                    defaultValue={state.checked === true ? "owned" : "all"}
                    className="w-auto"
                  >
                    <RadioGroupItem
                      value="owned"
                      disabled={state.disabled}
                      aria-invalid={state.invalid}
                      aria-label={`Owned only, ${state.label}`}
                    />
                  </RadioGroup>
                ),
              },
              {
                label: "Switch",
                render: (state) => (
                  <Switch
                    defaultChecked={state.checked}
                    disabled={state.disabled}
                    aria-invalid={state.invalid}
                    aria-label={`Show prices, ${state.label}`}
                  />
                ),
              },
            ]}
          />
        </DemoGroup>

        <DemoGroup {...GROUPS.toggle}>
          <Matrix<ToggleState>
            label="States"
            hint="outline and control share one fill ladder, and differ only in whether the element is a filter that can carry a value."
            states={TOGGLE_STATES}
            rows={[
              {
                label: "default",
                render: (state) => (
                  <Toggle {...state.props} aria-label={`Foils, ${state.label}`}>
                    Foils
                  </Toggle>
                ),
              },
              {
                label: "outline",
                render: (state) => (
                  <Toggle variant="outline" {...state.props} aria-label={`Foils, ${state.label}`}>
                    Foils
                  </Toggle>
                ),
              },
              {
                label: "control",
                render: (state) => (
                  <Toggle variant="control" {...state.props} aria-label={`Foils, ${state.label}`}>
                    Foils
                  </Toggle>
                ),
              },
            ]}
          />

          <SwatchRow label="Sizes">
            {TOGGLE_SIZES.map((size) => (
              <Swatch key={size} label={size}>
                <Toggle variant="outline" size={size} aria-label={`Foils, ${size}`}>
                  <HeartIcon /> Foils
                </Toggle>
              </Swatch>
            ))}
          </SwatchRow>
        </DemoGroup>

        <DemoGroup
          {...GROUPS.group}
          hint="Grouping changes only the corner radii: a ToggleGroupItem resolves to the same classes as a Toggle."
        >
          <DemoRow label="View modes">
            <ToggleGroup
              value={[view]}
              onValueChange={(value) => {
                const next = value.at(0);
                if (typeof next === "string") {
                  setView(next);
                }
              }}
            >
              <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
              <ToggleGroupItem value="table">Table</ToggleGroupItem>
            </ToggleGroup>
          </DemoRow>
        </DemoGroup>

        <DemoGroup
          {...GROUPS.iconGroup}
          hint="A single-choice row of view modes on the control surface; one option is always on. The default shows icons only, so every option needs a title or aria label. compact adds the labels at the small size."
        >
          <DemoGrid>
            <Demo name="default" hint="Icons only.">
              <IconToggleGroup
                aria-label="Display mode"
                options={DISPLAY_OPTIONS}
                value={display}
                onValueChange={setDisplay}
              />
            </Demo>
            <Demo name="compact" hint="Icons with labels.">
              <IconToggleGroup
                aria-label="Display mode, compact"
                options={DISPLAY_OPTIONS}
                value={display}
                onValueChange={setDisplay}
                compact
              />
            </Demo>
            <Demo name="three options" hint="Titles explain each option on hover.">
              <IconToggleGroup
                aria-label="View mode"
                options={VIEW_OPTIONS}
                value={tileView}
                onValueChange={setTileView}
                compact
              />
            </Demo>
          </DemoGrid>
        </DemoGroup>
      </SurfaceProbe>
    </DemoSection>
  );
}
