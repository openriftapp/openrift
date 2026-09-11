import { HeartIcon, PlusIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatSpecLine, observeThemeChanges, readElementSpec } from "@/hooks/use-element-spec";
import { cn } from "@/lib/utils";

import { DemoGroup, DemoRow, DemoSection, Swatch, SwatchRow } from "./demo-primitives";

const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "control",
  "outline",
  "ghost",
  "destructive",
  "dashed",
  "glass-pill",
  "link",
  "link-muted",
] as const;

const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;
const BUTTON_ICON_SIZES = ["icon-xs", "icon-sm", "icon", "icon-lg"] as const;
const TOGGLE_SIZES = ["sm", "default", "lg"] as const;

interface ButtonState {
  label: string;
  props: {
    "aria-expanded"?: boolean;
    "aria-invalid"?: boolean;
    "data-active"?: boolean;
    disabled?: boolean;
  };
}

const BUTTON_STATES: ButtonState[] = [
  { label: "rest", props: {} },
  { label: "expanded", props: { "aria-expanded": true } },
  { label: "active", props: { "data-active": true } },
  { label: "disabled", props: { disabled: true } },
  { label: "invalid", props: { "aria-invalid": true } },
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

interface FieldState {
  label: string;
  invalid?: boolean;
  disabled?: boolean;
}

const FIELD_STATES: FieldState[] = [
  { label: "rest" },
  { label: "invalid", invalid: true },
  { label: "disabled", disabled: true },
];

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

const FILLS = [
  { label: "transparent", className: "bg-transparent" },
  { label: "input/30", className: "bg-input/30" },
  { label: "muted/50", className: "bg-muted/50" },
  { label: "muted", className: "bg-muted" },
  { label: "secondary", className: "bg-secondary" },
  { label: "input/50", className: "bg-input/50" },
  { label: "primary", className: "bg-primary" },
  { label: "destructive/10", className: "bg-destructive/10" },
];

const SELECT_ITEMS = [
  { value: "any", label: "Any energy" },
  { value: "low", label: "0–2 energy" },
];

/** Ids are TOC targets: `DESIGN_CONTROL_GROUPS` is what the page nests under "Controls". */
const GROUPS = {
  button: { id: "controls-button", title: "Button" },
  toggle: { id: "controls-toggle", title: "Toggle" },
  textEntry: { id: "controls-text-entry", title: "Text entry" },
  choice: { id: "controls-choice", title: "Choice controls" },
  fills: { id: "controls-fills", title: "Fills in play" },
} as const;

export const DESIGN_CONTROL_GROUPS = Object.values(GROUPS);

/** Shared across every matrix so the nth state column lines up down the section. */
const LABEL_TRACK = "7rem";
const CELL_TRACK = "9rem";

interface Surface {
  name: string;
  background: string;
  color: string;
  borderColor: string;
  spec: string;
}

function readSurface(element: HTMLElement): Surface {
  const style = globalThis.getComputedStyle(element);
  return {
    name: element.dataset.slot ?? element.tagName.toLowerCase(),
    background: style.backgroundColor,
    color: style.color,
    borderColor: style.borderTopColor,
    spec: formatSpecLine(readElementSpec(element)),
  };
}

export function ControlsSection() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [surface, setSurface] = useState<Surface | null>(null);
  const [view, setView] = useState("grid");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const update = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        const found = target.closest<HTMLElement>("[data-slot]");
        if (found && found.dataset.slot !== "heading") {
          setSurface(readSurface(found));
        }
      }
    };
    root.addEventListener("pointerover", update);
    root.addEventListener("focusin", update);
    // Controls carry transition-colors, so the pointerover read lands on the
    // pre-hover color; the settled one only exists once the transition ends.
    root.addEventListener("transitionend", update);
    return () => {
      root.removeEventListener("pointerover", update);
      root.removeEventListener("focusin", update);
      root.removeEventListener("transitionend", update);
    };
  }, []);

  return (
    <DemoSection
      id="controls"
      title="Controls"
      note="Every variant, size and state of the interactive primitives in one place. Hover or focus a sample to read its settled colors — hover and focus are the two states no attribute can force."
      docs="docs/design-language.md"
    >
      <div ref={rootRef} className="space-y-8">
        <SurfaceReadout surface={surface} />

        <DemoGroup {...GROUPS.button}>
          <Matrix<ButtonState>
            label="States"
            hint="`control` is the shared filter-bar surface. Expanded is the popover-open state; active means a filter carries a value, and only `control` reacts to it."
            states={BUTTON_STATES}
            rows={BUTTON_VARIANTS.map((variant) => ({
              label: variant,
              render: (state) => (
                <Button variant={variant} {...state.props}>
                  Filter
                </Button>
              ),
            }))}
          />

          <SwatchRow label="Sizes" hint="Labeled sizes, shown on the outline variant.">
            {BUTTON_SIZES.map((size) => (
              <Swatch key={size} label={size}>
                <Button variant="outline" size={size}>
                  Button
                </Button>
              </Swatch>
            ))}
          </SwatchRow>

          <SwatchRow label="Icon sizes" hint="Square icon-only sizes, shown on the ghost variant.">
            {BUTTON_ICON_SIZES.map((size) => (
              <Swatch key={size} label={size}>
                <Button variant="ghost" size={size} aria-label={`Settings (${size})`}>
                  <SettingsIcon />
                </Button>
              </Swatch>
            ))}
          </SwatchRow>

          <DemoRow label="Composition" hint="Leading icons, and the joined group.">
            <Button>
              <PlusIcon /> Add card
            </Button>
            <Button variant="destructive">
              <Trash2Icon /> Delete deck
            </Button>
            <ButtonGroup>
              <Button variant="outline">Cards</Button>
              <ButtonGroupSeparator />
              <Button variant="outline">Printings</Button>
              <ButtonGroupSeparator />
              <Button variant="outline">Copies</Button>
            </ButtonGroup>
          </DemoRow>
        </DemoGroup>

        <DemoGroup {...GROUPS.toggle}>
          <Matrix<ToggleState>
            label="States"
            hint="ToggleGroupItem resolves to the same classes; grouping only changes the corner radii."
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

          <DemoRow label="Group" hint="The exclusive-choice strip (view modes).">
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

        <DemoGroup {...GROUPS.textEntry}>
          <Matrix<FieldState>
            label="States"
            hint="All four share one fill ladder: transparent in light, input/30 in dark, input/50 when disabled."
            states={FIELD_STATES}
            rows={[
              {
                label: "Input",
                render: (state) => (
                  <Input
                    className="w-32"
                    placeholder="Jinx"
                    aria-label={`Input, ${state.label}`}
                    aria-invalid={state.invalid}
                    disabled={state.disabled}
                  />
                ),
              },
              {
                label: "Textarea",
                render: (state) => (
                  <Textarea
                    className="w-32"
                    placeholder="Notes"
                    aria-label={`Textarea, ${state.label}`}
                    aria-invalid={state.invalid}
                    disabled={state.disabled}
                  />
                ),
              },
              {
                label: "InputGroup",
                render: (state) => (
                  <InputGroup className="w-32">
                    <InputGroupAddon>
                      <SearchGlyph />
                    </InputGroupAddon>
                    <InputGroupInput
                      placeholder="Jinx"
                      aria-label={`Search, ${state.label}`}
                      aria-invalid={state.invalid}
                      disabled={state.disabled}
                    />
                  </InputGroup>
                ),
              },
              {
                label: "Select",
                render: (state) => (
                  <Select items={SELECT_ITEMS} defaultValue="any" disabled={state.disabled}>
                    <SelectTrigger
                      className="w-32"
                      aria-label={`Energy, ${state.label}`}
                      aria-invalid={state.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SELECT_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ),
              },
            ]}
          />
        </DemoGroup>

        <DemoGroup {...GROUPS.choice}>
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

        <DemoGroup
          {...GROUPS.fills}
          hint="Every background a control surface resolves to, measured in the theme you are viewing."
        >
          <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
            {FILLS.map((fill) => (
              <FillSwatch key={fill.label} label={fill.label} className={fill.className} />
            ))}
          </div>
        </DemoGroup>
      </div>
    </DemoSection>
  );
}

function SurfaceReadout({ surface }: { surface: Surface | null }) {
  return (
    <div className="bg-background/85 no-scrollbar sticky top-(--sticky-top) z-10 flex h-9 items-center gap-x-5 overflow-x-auto rounded-lg border px-3 backdrop-blur">
      {surface ? (
        <>
          <p className="shrink-0 font-mono text-xs font-medium whitespace-nowrap">{surface.name}</p>
          <ReadoutValue label="bg" value={surface.background} />
          <ReadoutValue label="text" value={surface.color} />
          <ReadoutValue label="border" value={surface.borderColor} />
          <p className="text-muted-foreground text-2xs shrink-0 font-mono whitespace-nowrap">
            {surface.spec}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs whitespace-nowrap">
          Hover or focus a sample below to read its settled colors.
        </p>
      )}
    </div>
  );
}

function ReadoutValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span
        className="border-border-opaque inline-block size-3 shrink-0 rounded-sm border"
        style={{ backgroundColor: value }}
      />
      <span className="text-muted-foreground text-2xs font-mono whitespace-nowrap">
        {label} {value}
      </span>
    </span>
  );
}

function Matrix<S extends { label: string }>({
  label,
  hint,
  states,
  rows,
}: {
  label: string;
  hint: string;
  states: readonly S[];
  rows: readonly { label: string; render: (state: S) => ReactNode }[];
}) {
  return (
    <DemoRow label={label} hint={hint} className="block">
      <div className="overflow-x-auto">
        <div
          className="grid w-max items-center gap-x-4 gap-y-3"
          style={{ gridTemplateColumns: `${LABEL_TRACK} repeat(${states.length}, ${CELL_TRACK})` }}
        >
          <div />
          {states.map((state) => (
            <p
              key={state.label}
              className="text-muted-foreground text-2xs font-medium tracking-wide uppercase"
            >
              {state.label}
            </p>
          ))}
          {rows.map((row) => (
            <Fragment key={row.label}>
              <p className="text-muted-foreground pr-2 font-mono text-xs">{row.label}</p>
              {states.map((state) => (
                <div key={state.label} className="flex items-center">
                  {row.render(state)}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </DemoRow>
  );
}

function FillSwatch({ label, className }: { label: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [background, setBackground] = useState("");
  useEffect(() => {
    const measure = () => {
      const element = ref.current;
      if (element) {
        setBackground(globalThis.getComputedStyle(element).backgroundColor);
      }
    };
    measure();
    return observeThemeChanges(measure);
  }, []);
  return (
    <div className="flex flex-col gap-1.5">
      <div ref={ref} className={cn("border-border-opaque size-10 rounded-lg border", className)} />
      <div className="space-y-0.5">
        <p className="font-mono text-xs">{label}</p>
        <p className="text-muted-foreground text-2xs font-mono">{background || "measuring…"}</p>
      </div>
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
