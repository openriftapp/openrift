import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { CopyTextButton } from "@/components/copy-text-button";
import { Disclosure } from "@/components/disclosure";
import { DangerZone } from "@/components/layout/danger-zone";
import { LinkGoneState } from "@/components/link-gone-state";
import { NudgeCallout } from "@/components/nudge-callout";
import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/date-time-field";
import { InfoHint } from "@/components/ui/info-hint";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioOptionRow } from "@/components/ui/radio-option-row";
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
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { isValidTimeInput, localTimeZoneLabel } from "@/lib/date-time-input";

const GROUPS = {
  confirm: { id: "composed-confirm", title: "Confirm & responsive dialogs" },
  states: { id: "composed-states", title: "Nudges, gone links & danger zones" },
  inputs: { id: "composed-inputs", title: "Option rows, date-time & copy" },
} as const;

export const COMPOSED_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

function wait(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new -- wraps a callback-only timer
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function ComposedSection() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nudgeVisible, setNudgeVisible] = useState(true);
  const [destination, setDestination] = useState("inbox");
  const [date, setDate] = useState("2026-06-14");
  const [time, setTime] = useState("19:30");

  return (
    <DemoSection
      id="composed"
      title="Composed blocks"
      note="Primitives that bundle a recurring layout so feature code stops rebuilding it."
      docs="docs/design-language.md → Overlays"
    >
      <DemoGroup
        {...GROUPS.confirm}
        hint="Every confirm has an outline Cancel and the action on the right. Below md the responsive dialog is a bottom drawer."
      >
        <DemoRow label="ConfirmActionButton">
          <ConfirmActionButton
            title="Delete Jinx Aggro?"
            description="The deck and its plans are removed. Cards in your collection stay untouched."
            confirmLabel="Delete"
            pendingLabel="Deleting…"
            trigger={<Button variant="destructive" />}
            onConfirm={async () => {
              await wait(800);
              toast("Deleted (demo only)");
            }}
          >
            Delete deck
          </ConfirmActionButton>
          <ConfirmActionButton
            title="Reset your collections?"
            description='Every copy is removed. Type "reset" to continue.'
            confirmLabel="Reset"
            confirmPhrase="reset"
            trigger={<Button variant="outline" />}
            onConfirm={() => Promise.reject(new Error("demo failure"))}
          >
            Type to confirm (fails)
          </ConfirmActionButton>
        </DemoRow>
        <DemoRow label="ResponsiveDialog">
          <Button variant="outline" onClick={() => setSheetOpen(true)}>
            Pick a destination
          </Button>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.states}>
        <DemoRow label="NudgeCallout" className="flex-col items-stretch">
          {nudgeVisible ? (
            <NudgeCallout
              title="3 printings need images."
              body="Upload a scan to help us fill in the gaps."
              action={<Button size="sm">Add images</Button>}
              onDismiss={() => setNudgeVisible(false)}
            />
          ) : (
            <Button variant="outline" className="self-start" onClick={() => setNudgeVisible(true)}>
              Show nudge again
            </Button>
          )}
        </DemoRow>
        <DemoRow label="LinkGoneState" className="flex-col items-stretch">
          <div className="rounded-md border">
            <LinkGoneState
              width="capped"
              title="This link no longer works"
              description="The owner stopped sharing this deck or the link was mistyped."
              action={<Button variant="outline">Browse decks</Button>}
            />
          </div>
        </DemoRow>
        <DemoRow label="DangerZone" className="flex-col items-stretch">
          <DangerZone title="Danger zone" description="These actions cannot be undone.">
            <Button variant="secondary">Cancel tournament</Button>
            <Button variant="destructive">Delete tournament</Button>
          </DangerZone>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.inputs}>
        <DemoRow label="RadioOptionRow" className="flex-col items-stretch">
          <RadioGroup
            value={destination}
            onValueChange={(value) => setDestination(String(value))}
            className="max-w-md gap-0"
          >
            <RadioOptionRow
              value="inbox"
              title="Inbox"
              meta={<span className="text-muted-foreground text-xs">12 cards</span>}
            />
            <RadioOptionRow
              value="binder"
              title="Trade binder"
              description="Visible to your Summoner Skirmish group."
              meta={<span className="text-muted-foreground text-xs">48 cards</span>}
            />
            <RadioOptionRow value="locked" title="Archived" disabled />
          </RadioGroup>
        </DemoRow>
        <DemoRow label="DateTimeField" hint={`Local clock (${localTimeZoneLabel()}).`}>
          <DateTimeField
            label="Starts"
            date={date}
            time={time}
            onDateChange={setDate}
            onTimeChange={setTime}
            timeLabel="Start time"
            error={time !== "" && !isValidTimeInput(time) ? "Use HH:mm." : undefined}
          />
        </DemoRow>
        <DemoRow label="Copy, disclosure & hint icon">
          <CopyTextButton value="!deck jinx-aggro" label="Copy command" />
          <CopyTextButton value="ABC123" label="Copy code" iconOnly variant="ghost" />
          <span className="flex items-center gap-1 text-sm font-medium">
            Price
            <InfoHint label="Price" icon={TriangleAlertIcon}>
              No market price for this printing yet.
            </InfoHint>
          </span>
          <Disclosure title="Show older entries" variant="plain">
            Older changelog entries live here.
          </Disclosure>
        </DemoRow>
        <DemoRow label="Disclosure heading" hint="A collapsible page section.">
          <Disclosure variant="heading" icon={CheckIcon} title="Traded before" count={4}>
            Past trade partners live here.
          </Disclosure>
        </DemoRow>
      </DemoGroup>

      <ResponsiveDialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Move 3 cards</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              A dialog on desktop, a bottom drawer on phones.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <ResponsiveDialogCancel />
            <Button
              onClick={() => {
                setSheetOpen(false);
                toast("Moved (demo only)");
              }}
            >
              Move
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </DemoSection>
  );
}
