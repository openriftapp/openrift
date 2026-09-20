import {
  BellIcon,
  CopyIcon,
  HeartIcon,
  PackageIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { CountPillButton } from "@/components/ui/count-pill";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Pressable } from "@/components/ui/pressable";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Matrix,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

import { SurfaceProbe } from "./surface-probe";

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

const GROUPS = {
  button: { id: "actions-button", title: "Button" },
  topBar: { id: "actions-top-bar", title: "Top-bar buttons" },
  pressable: { id: "actions-pressable", title: "Pressable & disclosure" },
  chipActions: { id: "actions-chip-actions", title: "Chip actions" },
} as const;

export const ACTIONS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function ActionsSection() {
  const [expanded, setExpanded] = useState(true);
  const [iconOnlyExpanded, setIconOnlyExpanded] = useState(false);
  const [tags, setTags] = useState(["Aggro", "Budget", "Favorite"]);

  return (
    <DemoSection
      id="actions"
      title="Actions"
      note="Everything that commits an action when it is clicked."
      docs="docs/design-language.md"
    >
      <SurfaceProbe>
        <DemoGroup {...GROUPS.button}>
          <Matrix<ButtonState>
            label="States"
            hint="Expanded is the popover-open state, and active means a filter carries a value, which only `control` reacts to."
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

          <SwatchRow label="Sizes">
            {BUTTON_SIZES.map((size) => (
              <Swatch key={size} label={size}>
                <Button variant="outline" size={size}>
                  Button
                </Button>
              </Swatch>
            ))}
          </SwatchRow>

          <SwatchRow label="Icon sizes">
            {BUTTON_ICON_SIZES.map((size) => (
              <Swatch key={size} label={size}>
                <Button variant="ghost" size={size} aria-label={`Settings (${size})`}>
                  <SettingsIcon />
                </Button>
              </Swatch>
            ))}
          </SwatchRow>

          <DemoRow label="Composition">
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

        <DemoGroup
          {...GROUPS.topBar}
          hint="Only inside PageTopBarActions, and only one primary button per bar."
        >
          <SwatchRow label="Ladder">
            <Swatch label="PageTopBarButton" colors>
              <PageTopBarButton>
                <CopyIcon /> Copy code
              </PageTopBarButton>
            </Swatch>
            <Swatch label="PageTopBarPrimaryButton" colors>
              <PageTopBarPrimaryButton>
                <PlusIcon /> New deck
              </PageTopBarPrimaryButton>
            </Swatch>
            <Swatch label="PageTopBarIconButton">
              <PageTopBarIconButton aria-label="Notifications">
                <BellIcon />
              </PageTopBarIconButton>
            </Swatch>
            <Swatch label="PageTopBarBack">
              <PageTopBarBack to="/admin" aria-label="Back to admin" />
            </Swatch>
          </SwatchRow>
        </DemoGroup>

        <DemoGroup {...GROUPS.pressable}>
          <DemoRow label="Pressable">
            <Pressable
              className="hover:bg-muted/50 flex w-full max-w-sm items-center gap-3 rounded-lg border p-2"
              onClick={() => toast("Row pressed")}
            >
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-md">
                <PackageIcon className="text-muted-foreground size-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">Piltover Trader</div>
                <div className="text-muted-foreground text-xs">OGN-042 · Epic</div>
              </div>
            </Pressable>
          </DemoRow>
          <DemoRow label="ExpandToggle (labeled)">
            <div className="w-full max-w-sm space-y-2">
              <ExpandToggle expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                <span className="font-medium">Sideboard plan</span>
                <span className="text-muted-foreground text-xs">3 matchups</span>
              </ExpandToggle>
              {expanded && (
                <p className="text-muted-foreground pl-6 text-sm">
                  Against control, bring in the burn package.
                </p>
              )}
            </div>
          </DemoRow>
          <DemoRow label="ExpandToggle (icon-only)">
            <ExpandToggle
              expanded={iconOnlyExpanded}
              onClick={() => setIconOnlyExpanded((v) => !v)}
              aria-label={iconOnlyExpanded ? "Collapse" : "Expand"}
              className="text-muted-foreground hover:text-foreground"
            />
          </DemoRow>
        </DemoGroup>

        <DemoGroup
          {...GROUPS.chipActions}
          hint="ChipRemoveButton is the only way to put an action inside a Badge."
        >
          <DemoRow label="ChipRemoveButton">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <ChipRemoveButton
                  aria-label={`Remove ${tag}`}
                  onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                />
              </Badge>
            ))}
            {tags.length < 3 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setTags(["Aggro", "Budget", "Favorite"])}
              >
                Reset
              </Button>
            )}
          </DemoRow>
          <SwatchRow label="CountPillButton">
            <Swatch label="rest">
              <CountPillButton onClick={() => toast.success("Requested")}>
                <HeartIcon className="size-3" />
                <span>Request</span>
              </CountPillButton>
            </Swatch>
            <Swatch label="disabled">
              <CountPillButton disabled>
                <HeartIcon className="size-3" />
                <span>Request</span>
              </CountPillButton>
            </Swatch>
          </SwatchRow>
        </DemoGroup>
      </SurfaceProbe>
    </DemoSection>
  );
}
