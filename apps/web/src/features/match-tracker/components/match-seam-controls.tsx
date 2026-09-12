import {
  CheckIcon,
  DicesIcon,
  FlagIcon,
  RotateCcwIcon,
  Settings2Icon,
  Undo2Icon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pressable } from "@/components/ui/pressable";
import {
  describeAction,
  useMatchTrackerStore,
} from "@/features/match-tracker/stores/match-tracker-store";
import { useFirstPlayerSpotlight } from "@/hooks/use-first-player-spotlight";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const SEAM_BUTTON_CLASS =
  "bg-popover hover:border-primary grid size-8 place-items-center rounded-full border shadow-sm transition-colors disabled:opacity-50";

// Only symmetric icons work here: the seam is upside down for whoever sits on the far side.
export function MatchSeamControls() {
  const { isRolling, roll } = useFirstPlayerSpotlight();
  // A plain string compares by value, so no shallow wrapper is needed here.
  const undoLabel = useMatchTrackerStore((state) =>
    describeAction(state.log.at(-1), state.players),
  );
  const undoLast = useMatchTrackerStore((state) => state.undoLast);
  const startGame = useMatchTrackerStore((state) => state.startGame);
  const backToSetup = useMatchTrackerStore((state) => state.backToSetup);
  // Subscribe to the raw (referentially stable) players array; mapping to fresh
  // objects in the selector would trigger a render loop.
  const players = useMatchTrackerStore((state) => state.players);
  const firstPlayerId = useMatchTrackerStore((state) => state.firstPlayerId);
  const setFirstPlayer = useMatchTrackerStore((state) => state.setFirstPlayer);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center">
      <div className="pointer-events-auto flex gap-2">
        <Pressable
          aria-label={m.tracker_seam_roll_first()}
          disabled={isRolling}
          onClick={() => roll()}
          className={cn(SEAM_BUTTON_CLASS, isRolling && "cursor-default")}
        >
          <DicesIcon className="text-muted-foreground size-4" />
        </Pressable>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Pressable aria-label={m.tracker_seam_menu()} className={SEAM_BUTTON_CLASS} />}
          >
            <Settings2Icon className="text-muted-foreground size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuItem disabled={undoLabel === null} onClick={() => undoLast()}>
              <Undo2Icon className="size-4" />
              {undoLabel ?? m.tracker_seam_nothing_to_undo()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => startGame()}>
              <RotateCcwIcon className="size-4" />
              {m.tracker_seam_new_round()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => backToSetup()}>
              <Settings2Icon className="size-4" />
              {m.tracker_seam_back_to_setup()}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>{m.tracker_goes_first()}</DropdownMenuLabel>
              {players.map((player) => (
                <DropdownMenuItem key={player.id} onClick={() => setFirstPlayer(player.id)}>
                  <FlagIcon className="size-4" />
                  {player.name}
                  {player.id === firstPlayerId && <CheckIcon className="ml-auto size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
