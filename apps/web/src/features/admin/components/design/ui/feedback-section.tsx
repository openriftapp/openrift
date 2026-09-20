import { InfoIcon, PackageIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";

const GROUPS = {
  toasts: { id: "feedback-toasts", title: "Toasts" },
  alerts: { id: "feedback-alerts", title: "Alerts & notes" },
  progress: { id: "feedback-progress", title: "Progress" },
  empty: { id: "feedback-empty", title: "Empty state" },
} as const;

export const FEEDBACK_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function FeedbackSection() {
  return (
    <DemoSection
      id="feedback"
      title="Feedback"
      note="What the app says back after an action, and what it shows while a surface has nothing in it."
      docs="docs/design-language.md → Callouts, notes and code"
    >
      <DemoGroup {...GROUPS.toasts}>
        <DemoRow label="sonner">
          <Button variant="outline" onClick={() => toast.success("Added 4× Teemo, Swift Scout")}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => toast.error("Could not copy deck code")}>
            Error toast
          </Button>
        </DemoRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.alerts}
        hint="Reach for these only for a state that appeared, never for copy that renders on every visit."
      >
        <DemoRow label="Alert" className="max-w-xl flex-col items-stretch">
          <Alert>
            <InfoIcon />
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>Prices refresh once a day.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>3 lines could not be matched to the catalog.</AlertDescription>
          </Alert>
          <Alert variant="warning">
            <TriangleAlertIcon />
            <AlertTitle>Rotation next week</AlertTitle>
            <AlertDescription>Two of your decks lose cards on Sept 10.</AlertDescription>
          </Alert>
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>Shared with your group</AlertTitle>
            <AlertDescription>Everyone in Tuesday Night Crew can see this list.</AlertDescription>
          </Alert>
        </DemoRow>
        <DemoRow
          label="Callout"
          hint="variant inset is the borderless form for a note inside a Card, dialog or form."
          className="max-w-xl flex-col items-stretch"
        >
          <Callout className="text-sm">
            <p className="font-medium">Welcome to your collection</p>
            <p className="text-muted-foreground mt-0.5">
              Tap the + on any card to add it, or paste a deck code to import one.
            </p>
          </Callout>
          <div className="bg-card rounded-lg border p-4">
            <p className="text-sm font-medium">Publish standings</p>
            <Callout variant="inset" className="mt-2">
              <p className="text-muted-foreground text-sm">
                Standings stay hidden until the first round is paired.
              </p>
            </Callout>
          </div>
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.progress}>
        <DemoGrid>
          <Demo name="Progress" hint="Determinate completion, like imports and collection goals.">
            <Progress value={64} className="w-40" aria-label="Collection progress" />
          </Demo>
          <Demo name="Skeleton" hint="Loading placeholder shaped like the coming content.">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </Demo>
        </DemoGrid>
      </DemoGroup>

      <DemoGroup {...GROUPS.empty}>
        <DemoRow label="Empty" className="block">
          <Empty className="max-w-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageIcon />
              </EmptyMedia>
              <EmptyTitle>No decks yet</EmptyTitle>
              <EmptyDescription>Build your first deck to see it here.</EmptyDescription>
            </EmptyHeader>
            <Button size="sm">
              <PlusIcon /> New deck
            </Button>
          </Empty>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
