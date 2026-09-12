import type { ReactNode } from "react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type GroupVisibilityMode = "all" | "selected" | "none";

const VISIBILITY_OPTIONS: { value: GroupVisibilityMode; label: string }[] = [
  { value: "all", label: "All my groups" },
  { value: "selected", label: "Some groups" },
  { value: "none", label: "Only me" },
];

export interface VisibilityGroup {
  id: string;
  slug: string;
  name: string;
}

interface GroupVisibilitySectionProps {
  groups: readonly VisibilityGroup[];
  sharedGroupIds: ReadonlySet<string>;
  onShare: (group: VisibilityGroup) => void;
  onUnshare: (group: VisibilityGroup) => void;
  pending: boolean;
  description: ReactNode;
  emptyNote: ReactNode;
  /** Prefixes the radio and checkbox ids, so two sections can coexist on a page. */
  idPrefix: string;
}

/** Which friend groups can see a shared surface; used by both lists and collections. */
export function GroupVisibilitySection({
  groups,
  sharedGroupIds,
  onShare,
  onUnshare,
  pending,
  description,
  emptyNote,
  idPrefix,
}: GroupVisibilitySectionProps) {
  // Sticky while interacting: picking "Some groups" must not bounce back to a
  // derived "all"/"none" when the checkboxes momentarily match those states.
  const [modeOverride, setModeOverride] = useState<GroupVisibilityMode | null>(null);

  const derivedMode: GroupVisibilityMode =
    sharedGroupIds.size === 0 ? "none" : sharedGroupIds.size >= groups.length ? "all" : "selected";
  const mode = modeOverride ?? derivedMode;

  const applyMode = (next: GroupVisibilityMode) => {
    setModeOverride(next);
    if (next === "all") {
      for (const group of groups) {
        if (!sharedGroupIds.has(group.id)) {
          onShare(group);
        }
      }
    } else if (next === "none") {
      for (const group of groups) {
        if (sharedGroupIds.has(group.id)) {
          onUnshare(group);
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="font-medium">Group visibility</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyNote}</p>
      ) : (
        <>
          <RadioGroup
            value={mode}
            onValueChange={(next) => applyMode(next as GroupVisibilityMode)}
            className="flex flex-col gap-2"
          >
            {VISIBILITY_OPTIONS.map((option) => {
              const radioId = `${idPrefix}-visibility-${option.value}`;
              return (
                <div key={option.value} className="flex items-center gap-2">
                  <RadioGroupItem id={radioId} value={option.value} disabled={pending} />
                  <label htmlFor={radioId} className="cursor-pointer text-sm">
                    {option.label}
                  </label>
                </div>
              );
            })}
          </RadioGroup>
          {mode === "selected" ? (
            <ul className="flex flex-col gap-2 ps-6">
              {groups.map((group) => {
                const checkboxId = `${idPrefix}-group-${group.id}`;
                return (
                  <li key={group.id} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId}
                      checked={sharedGroupIds.has(group.id)}
                      disabled={pending}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          onShare(group);
                        } else if (checked === false) {
                          onUnshare(group);
                        }
                      }}
                    />
                    <label htmlFor={checkboxId} className="cursor-pointer text-sm">
                      {group.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
