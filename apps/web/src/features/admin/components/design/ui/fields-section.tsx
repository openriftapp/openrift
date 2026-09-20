import { CameraIcon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";
import { Dropzone } from "@/components/ui/dropzone";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { QuantityStepper, QuantityStepperField } from "@/components/ui/quantity-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
  FillSwatch,
  Matrix,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

import { SurfaceProbe } from "./surface-probe";

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

const ENERGY_ITEMS = [
  { value: "any", label: "Any energy" },
  { value: "low", label: "0–2 energy" },
  { value: "high", label: "6+ energy" },
];

const GROUPS = {
  textEntry: { id: "fields-text-entry", title: "Text entry" },
  field: { id: "fields-field", title: "Field" },
  date: { id: "fields-date", title: "Date" },
  number: { id: "fields-number", title: "Number" },
  special: { id: "fields-special", title: "Special entry" },
  row: { id: "fields-row", title: "Control row" },
  fills: { id: "fields-fills", title: "Fills in play" },
} as const;

export const FIELDS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function FieldsSection() {
  const [date, setDate] = useState<string | undefined>();
  const [energy, setEnergy] = useState("any");
  const [copies, setCopies] = useState(2);

  return (
    <DemoSection
      id="fields"
      title="Fields"
      note="Anything that takes a typed or picked value from the viewer."
      docs="docs/design-language.md → Control rows"
    >
      <SurfaceProbe>
        <DemoGroup {...GROUPS.textEntry}>
          <Matrix<FieldState>
            label="States"
            hint="All four sit on the shared control rest fill and mark disabled with opacity alone."
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
                      <SearchIcon />
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
                  <Select items={ENERGY_ITEMS} defaultValue="any" disabled={state.disabled}>
                    <SelectTrigger
                      className="w-32"
                      aria-label={`Energy, ${state.label}`}
                      aria-invalid={state.invalid}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENERGY_ITEMS.map((item) => (
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

        <DemoGroup {...GROUPS.field}>
          <DemoGrid>
            <Demo
              name="Field + Input"
              hint="Label, control, helper text."
              spec="input h-8 · text-base mobile, md:text-sm"
            >
              <Field>
                <FieldLabel htmlFor="design-name">Deck name</FieldLabel>
                <Input id="design-name" placeholder="Jinx Aggro" />
                <FieldDescription>Shown on your public deck page.</FieldDescription>
              </Field>
            </Demo>
            <Demo
              name="Field (invalid)"
              hint="aria-invalid on the control drives the error styling."
            >
              <Field data-invalid>
                <FieldLabel htmlFor="design-code">Deck code</FieldLabel>
                <Input id="design-code" aria-invalid placeholder="RIFT-…" />
                <FieldError>That code doesn&apos;t look right.</FieldError>
              </Field>
            </Demo>
          </DemoGrid>
        </DemoGroup>

        <DemoGroup
          {...GROUPS.date}
          hint="Date entry is always a DatePicker, never a raw date input."
        >
          <DemoGrid>
            <Demo name="DatePicker" hint="The picker a form reaches for.">
              <DatePicker value={date} onChange={setDate} onClear={() => setDate(undefined)} />
            </Demo>
            <Demo name="Calendar" hint="The month grid inside the picker.">
              <Calendar mode="single" className="rounded-md border" />
            </Demo>
          </DemoGrid>
        </DemoGroup>

        <DemoGroup {...GROUPS.number}>
          <DemoGrid>
            <Demo
              name="QuantityStepper"
              hint="editable swaps the value for a typable field."
              spec="icon buttons size-8 · value w-8 tabular-nums (or w-16 input) · clamped to min/max"
            >
              <div className="w-full space-y-3">
                <QuantityStepper value={copies} onValueChange={setCopies} max={4} />
                <QuantityStepper value={copies} onValueChange={setCopies} max={4} editable />
                <QuantityStepperField
                  label="Copies to move"
                  value={copies}
                  onValueChange={setCopies}
                  max={4}
                />
              </div>
            </Demo>
            <Demo name="Slider" hint="Numeric range entry, like column count or max energy.">
              <Slider defaultValue={[3]} max={10} className="w-40" aria-label="Max energy" />
            </Demo>
          </DemoGrid>
        </DemoGroup>

        <DemoGroup {...GROUPS.special}>
          <DemoGrid>
            <Demo name="InputOTP" hint="Verification-code entry for email codes.">
              <InputOTP maxLength={6}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </Demo>
            <Demo name="Kbd" hint="Keyboard shortcut hints in menus and palettes.">
              <KbdGroup>
                <Kbd>Ctrl</Kbd>
                <Kbd>K</Kbd>
              </KbdGroup>
            </Demo>
            <Demo
              name="Dropzone"
              hint="cameraLabel adds a capture button that shows on touch devices only."
              spec="dashed border · primary tint while dragging"
            >
              <Dropzone
                className="w-full"
                multiple
                accept="image/*"
                icon={<UploadIcon className="text-muted-foreground size-5" />}
                label="Drop photos here or click to choose"
                hint="JPG, PNG or WebP, up to 50 MB each."
                cameraLabel="Take a photo"
                cameraIcon={<CameraIcon className="size-4" />}
                onFiles={(files) => toast.success(`${files.length} file(s) picked`)}
              />
            </Demo>
          </DemoGrid>
        </DemoGroup>

        <DemoGroup {...GROUPS.row}>
          <DemoRow
            label="Aligned row"
            hint="Boxed controls in one row share the h-8 tier, and compact sizes never mix in."
            className="block"
          >
            <div className="flex w-full max-w-2xl items-center gap-2">
              <Select
                items={ENERGY_ITEMS}
                value={energy}
                onValueChange={(v) => {
                  if (v !== null) {
                    setEnergy(v);
                  }
                }}
              >
                <SelectTrigger className="w-36 shrink-0" aria-label="Energy cost">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENERGY_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Value…" className="flex-1" aria-label="Value" />
              <Button variant="outline">
                <PlusIcon /> Add
              </Button>
            </div>
          </DemoRow>
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
      </SurfaceProbe>
    </DemoSection>
  );
}
