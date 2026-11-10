import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { GroupStageView } from "@openrift/shared/types/api/pod-tournament";
import { EllipsisVerticalIcon, GripVerticalIcon } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useReplaceGroupSeats } from "@/features/tournaments/hooks/use-tournament-run";
import { asDragData } from "@/lib/dnd-data";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SeatDragData {
  type: "group-seat";
  playerId: string;
}

const SEAT_TYPES = ["group-seat"] as const satisfies readonly SeatDragData["type"][];

export interface SeatGroup {
  label: string;
  pairedGroupLabel: string | null;
  playerIds: string[];
}

/** Swaps the seats of two players, within one group or across two. */
export function swapSeats(groups: readonly SeatGroup[], a: string, b: string): SeatGroup[] {
  if (a === b) {
    return [...groups];
  }
  return groups.map((group) => ({
    ...group,
    playerIds: group.playerIds.map((playerId) =>
      playerId === a ? b : playerId === b ? a : playerId,
    ),
  }));
}

function scheduleHint(size: number): string {
  return size === 4
    ? "Seats set the schedule: round 1 pairs seats 1 and 2, 3 and 4; round 2 pairs 1 and 3, 2 and 4; round 3 pairs 1 and 4, 2 and 3."
    : "Seats set the schedule: seat 1 plays across in round 1, seat 2 in round 2, seat 3 in round 3; the other two play each other.";
}

function SeatChip({ playerId, name }: { playerId: string; name: string }) {
  const draggable = useDraggable({
    id: `seat:${playerId}`,
    data: { type: "group-seat", playerId } satisfies SeatDragData,
  });
  const droppable = useDroppable({
    id: `seat-target:${playerId}`,
    data: { type: "group-seat", playerId } satisfies SeatDragData,
  });
  return (
    <span
      ref={(node) => {
        draggable.setNodeRef(node);
        droppable.setNodeRef(node);
      }}
      {...draggable.listeners}
      className={cn(
        "bg-background flex cursor-grab touch-none items-center gap-1.5 rounded-md border px-2 py-1 text-sm",
        draggable.isDragging && "opacity-40",
        droppable.isOver && !draggable.isDragging && "ring-primary ring-2",
      )}
    >
      <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{name}</span>
    </span>
  );
}

interface SwapOption {
  playerId: string;
  name: string;
  groupLabel: string;
  seat: number;
}

function SwapMenu({
  playerId,
  name,
  options,
  onSwap,
}: {
  playerId: string;
  name: string;
  options: SwapOption[];
  onSwap: (otherId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-swap-player={playerId}
        aria-label={m.tournaments_seat_editor_swap_label({ name })}
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground pointer-coarse:size-9"
          >
            <EllipsisVerticalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.tournaments_seat_editor_swap_with()}</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuItem key={option.playerId} onClick={() => onSwap(option.playerId)}>
              <span>{option.name}</span>
              <span className="text-muted-foreground ml-auto pl-3">
                {m.tournaments_seat_editor_swap_seat({
                  label: option.groupLabel,
                  seat: option.seat,
                })}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupSeatEditor({
  id,
  groupStage,
  onClose,
}: {
  id: string;
  groupStage: GroupStageView;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<SeatGroup[]>(() =>
    groupStage.groups.map((group) => ({
      label: group.label,
      pairedGroupLabel: group.pairedGroupLabel,
      playerIds: [...group.playerIds],
    })),
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const replace = useReplaceGroupSeats();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const nameById = new Map(
    groupStage.groups.flatMap((group) =>
      group.standings.map((row) => [row.playerId, row.displayName] as const),
    ),
  );
  const sizes = new Set(groups.map((group) => group.playerIds.length));
  const rootRef = useRef<HTMLDivElement>(null);
  const nameOf = (playerId: string) =>
    nameById.get(playerId) ?? m.tournaments_pairing_editor_unknown_player();
  const seats: SwapOption[] = groups.flatMap((group) =>
    group.playerIds.map((playerId, seat) => ({
      playerId,
      name: nameOf(playerId),
      groupLabel: group.label,
      seat: seat + 1,
    })),
  );

  function applySwap(a: string, b: string) {
    setGroups((current) => swapSeats(current, a, b));
  }

  // A swap across groups remounts the chip, so the menu's own focus return has
  // no trigger left to land on.
  function handleMenuSwap(playerId: string, otherId: string) {
    flushSync(() => applySwap(playerId, otherId));
    const triggers = rootRef.current?.querySelectorAll<HTMLElement>("[data-swap-player]") ?? [];
    [...triggers].find((trigger) => trigger.dataset.swapPlayer === playerId)?.focus();
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(
      asDragData<SeatDragData>(event.active.data.current, SEAT_TYPES)?.playerId ?? null,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const drag = asDragData<SeatDragData>(event.active.data.current, SEAT_TYPES);
    const drop = asDragData<SeatDragData>(event.over?.data.current, SEAT_TYPES);
    if (drag && drop) {
      applySwap(drag.playerId, drop.playerId);
    }
  }

  async function handleSave() {
    try {
      await replace.mutateAsync({
        id,
        groups: groups.map((group) => ({ label: group.label, playerIds: group.playerIds })),
      });
      onClose();
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={rootRef} className="flex flex-col gap-4">
        <Heading as="h3">{m.tournaments_group_edit_groups()}</Heading>
        <p className="text-muted-foreground text-sm">{m.tournaments_seat_editor_hint()}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.label} className="gap-2">
              <CardHeader className="gap-1">
                <CardTitle className="flex items-center gap-2">
                  <span>{m.tournaments_group_heading({ label: group.label })}</span>
                  {group.pairedGroupLabel === null ? null : (
                    <Badge variant="info">
                      {m.tournaments_group_paired_with({ label: group.pairedGroupLabel })}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {group.playerIds.map((playerId, seat) => (
                  <div key={playerId} className="flex items-center gap-2">
                    <span className="text-muted-foreground w-4 shrink-0 text-right text-xs tabular-nums">
                      {seat + 1}
                    </span>
                    <SeatChip playerId={playerId} name={nameOf(playerId)} />
                    <SwapMenu
                      playerId={playerId}
                      name={nameOf(playerId)}
                      options={seats.filter((option) => option.playerId !== playerId)}
                      onSwap={(otherId) => handleMenuSwap(playerId, otherId)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-muted-foreground flex flex-col gap-1 text-sm">
          {[...sizes].toSorted().map((size) => (
            <p key={size}>{scheduleHint(size)}</p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={replace.isPending}>
            {m.common_cancel()}
          </Button>
          <Button onClick={() => void handleSave()} disabled={replace.isPending}>
            {replace.isPending
              ? m.tournaments_pairing_editor_saving()
              : m.tournaments_seat_editor_save()}
          </Button>
        </div>
      </div>
      <DragOverlay>
        {draggingId ? (
          <span className="bg-background flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm shadow-lg">
            <GripVerticalIcon className="text-muted-foreground size-3.5 shrink-0" />
            {nameById.get(draggingId) ?? m.tournaments_pairing_editor_unknown_player()}
          </span>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
