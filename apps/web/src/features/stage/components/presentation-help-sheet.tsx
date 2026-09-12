import { Kbd } from "@/components/ui/kbd";
import { m } from "@/paraglide/messages.js";

interface KeyHelpRow {
  keys: string[];
  what: string;
}

function walkKeyHelp(): KeyHelpRow[] {
  return [
    { keys: ["←", "→"], what: m.stage_help_step_queue() },
    { keys: ["Space"], what: m.stage_help_next_card() },
    { keys: ["Home", "End"], what: m.stage_help_first_last() },
    { keys: ["T"], what: m.stage_toggle_text_panel() },
    { keys: ["F"], what: m.stage_toggle_thumbnail_strip() },
  ];
}

function boardKeyHelp(): KeyHelpRow[] {
  return [
    { keys: ["B"], what: m.stage_help_board_toggle() },
    { keys: ["C"], what: m.stage_help_card_beside_board() },
    { keys: ["K"], what: m.stage_help_tier_large() },
    { keys: ["R"], what: m.stage_help_fill_board() },
    { keys: ["D"], what: m.stage_help_start_bottom() },
  ];
}

function pushKeyHelp(): KeyHelpRow[] {
  return [{ keys: ["P"], what: m.stage_help_push_card() }];
}

function obsBoardKeyHelp(): KeyHelpRow[] {
  return [{ keys: ["O"], what: m.stage_help_show_board_obs() }];
}

function hideKeyHelp(): KeyHelpRow[] {
  return [{ keys: ["H"], what: m.stage_help_hide_overlay() }];
}

function commonKeyHelp(): KeyHelpRow[] {
  return [
    { keys: ["?"], what: m.stage_help_this_help() },
    { keys: ["Esc"], what: m.stage_help_leave() },
  ];
}

export function PresentationHelpSheet({
  boardControls,
  pushControls,
  obsControls,
  editControls,
  editing,
}: {
  boardControls: boolean;
  pushControls: boolean;
  obsControls: boolean;
  editControls: boolean;
  editing: boolean;
}) {
  const rows: KeyHelpRow[] = [
    ...(editing ? [] : walkKeyHelp()),
    ...(boardControls && !editing ? boardKeyHelp() : []),
    ...(pushControls && !editing ? pushKeyHelp() : []),
    ...(obsControls && !editing ? obsBoardKeyHelp() : []),
    ...(pushControls ? hideKeyHelp() : []),
    ...(editControls
      ? [{ keys: ["E"], what: editing ? m.stage_help_back_to_show() : m.stage_toggle_edit_board() }]
      : []),
    ...commonKeyHelp(),
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center pb-8">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 rounded-lg bg-black/80 px-6 py-5 backdrop-blur-sm">
        {rows.map((row) => (
          <div key={row.what} className="contents">
            <dt className="flex justify-end gap-1">
              {row.keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </dt>
            <dd className="text-sm text-white/70">{row.what}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
