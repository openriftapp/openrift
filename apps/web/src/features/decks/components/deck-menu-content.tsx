import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BoxIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCopyIcon,
  ClipboardListIcon,
  CopyPlusIcon,
  FileTextIcon,
  FlaskConicalIcon,
  FolderIcon,
  Gamepad2Icon,
  GitBranchIcon,
  GitBranchPlusIcon,
  GitCompareArrowsIcon,
  ImageDownIcon,
  ImageIcon,
  LayersIcon,
  LayoutGridIcon,
  LinkIcon,
  MonitorPlayIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlayIcon,
  PrinterIcon,
  RefreshCwIcon,
  Settings2Icon,
  SettingsIcon,
  StarIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  DeckMenuAction,
  DeckMenuContext,
  DeckMenuModel,
} from "@/features/decks/lib/deck-menu-model";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { m } from "@/paraglide/messages.js";

type SubView = "edit" | "copies" | "organize" | "format" | "folders";

const PARENT_VIEW: Record<SubView, SubView | null> = {
  edit: null,
  copies: null,
  organize: null,
  format: "edit",
  folders: "organize",
};

export interface DeckMenuContentProps {
  model: DeckMenuModel;
  context: DeckMenuContext;
  deck: { isPinned: boolean; isDraft: boolean; archived: boolean };
  boxName?: string;
  compareFrom: string;
  formats: readonly { slug: string; label: string }[];
  folders?: readonly { id: string; name: string; checked: boolean }[];
  prefix?: ReactNode;
  onAction: (action: DeckMenuAction) => void;
  onFormat?: (slug: string, label: string) => void;
  onToggleFolder?: (folderId: string) => void;
  onManageFolders?: () => void;
}

interface EntryLook {
  icon: LucideIcon;
  label: string;
}

function entryLook(action: DeckMenuAction, props: DeckMenuContentProps): EntryLook {
  const { deck, context } = props;
  switch (action) {
    case "present": {
      return { icon: MonitorPlayIcon, label: m.decks_menu_present() };
    }
    case "play": {
      return { icon: PlayIcon, label: m.decks_menu_play_riftatlas() };
    }
    case "compare": {
      return { icon: GitCompareArrowsIcon, label: m.decks_menu_compare() };
    }
    case "shareLink": {
      return { icon: LinkIcon, label: m.decks_menu_link_qr() };
    }
    case "saveImage": {
      return { icon: ImageDownIcon, label: m.decks_menu_save_image() };
    }
    case "copyText": {
      return { icon: FileTextIcon, label: m.decks_menu_copy_text() };
    }
    case "copyCode": {
      return { icon: ClipboardCopyIcon, label: m.decks_menu_copy_code() };
    }
    case "copyTts": {
      return { icon: Gamepad2Icon, label: m.decks_menu_copy_tts() };
    }
    case "printProxies": {
      return { icon: PrinterIcon, label: m.decks_menu_print_proxies() };
    }
    case "printRegistration": {
      return { icon: ClipboardListIcon, label: m.decks_menu_print_registration() };
    }
    case "storedIn": {
      return { icon: BoxIcon, label: m.decks_menu_stored_in() };
    }
    case "details": {
      return { icon: PencilIcon, label: m.decks_menu_name_description() };
    }
    case "rename": {
      return { icon: PencilIcon, label: m.common_rename() };
    }
    case "cover": {
      return { icon: ImageIcon, label: m.decks_menu_change_cover() };
    }
    case "changeFormat": {
      return { icon: RefreshCwIcon, label: m.decks_menu_change_format() };
    }
    case "importReplace": {
      return { icon: UploadIcon, label: m.decks_menu_import_replace() };
    }
    case "duplicate": {
      return { icon: CopyPlusIcon, label: m.decks_menu_duplicate() };
    }
    case "newVariant": {
      return { icon: GitBranchPlusIcon, label: m.decks_menu_new_variant() };
    }
    case "variants": {
      return { icon: GitBranchIcon, label: m.decks_menu_variants() };
    }
    case "makePrimary": {
      return { icon: StarIcon, label: m.decks_menu_make_primary() };
    }
    case "pin": {
      return deck.isPinned
        ? { icon: PinOffIcon, label: m.decks_menu_unpin() }
        : { icon: PinIcon, label: m.decks_menu_pin() };
    }
    case "folders": {
      return { icon: FolderIcon, label: m.decks_menu_add_to_folder() };
    }
    case "draft": {
      return {
        icon: FlaskConicalIcon,
        label: deck.isDraft ? m.decks_menu_unmark_draft() : m.decks_menu_mark_draft(),
      };
    }
    case "archive": {
      return deck.archived
        ? { icon: ArchiveRestoreIcon, label: m.decks_menu_unarchive() }
        : { icon: ArchiveIcon, label: m.decks_menu_archive() };
    }
    case "unarchive": {
      return { icon: ArchiveRestoreIcon, label: m.decks_menu_unarchive() };
    }
    case "delete": {
      return {
        icon: Trash2Icon,
        label: context === "editor" ? m.decks_menu_delete_deck() : m.common_delete(),
      };
    }
  }
}

function subViewLook(view: SubView, context: DeckMenuContext): EntryLook {
  switch (view) {
    case "edit": {
      return context === "editor"
        ? { icon: PencilIcon, label: m.decks_menu_details() }
        : { icon: Settings2Icon, label: m.decks_menu_edit_deck() };
    }
    case "copies": {
      return { icon: LayersIcon, label: m.decks_menu_copies_variants() };
    }
    case "organize": {
      return { icon: LayoutGridIcon, label: m.decks_menu_organize() };
    }
    case "format": {
      return { icon: RefreshCwIcon, label: m.decks_menu_change_format() };
    }
    case "folders": {
      return { icon: FolderIcon, label: m.decks_menu_add_to_folder() };
    }
  }
}

function ActionItem({ action, props }: { action: DeckMenuAction; props: DeckMenuContentProps }) {
  const { icon: Icon, label } = entryLook(action, props);
  const disabled = props.model.disabled.has(action);
  const hint =
    disabled && action === "play"
      ? m.decks_menu_no_cards()
      : action === "storedIn"
        ? (props.boxName ?? m.decks_menu_no_box())
        : action === "saveImage"
          ? m.decks_menu_save_image_hint()
          : null;
  if (action === "compare") {
    return (
      <DropdownMenuItem
        render={<Link to="/decks/compare" search={{ from: props.compareFrom, to: undefined }} />}
      >
        <Icon />
        {label}
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem
      variant={action === "delete" ? "destructive" : "default"}
      disabled={disabled}
      onClick={() => props.onAction(action)}
    >
      <Icon />
      {label}
      {hint === null ? null : (
        <span className="text-muted-foreground ml-auto pl-4 text-xs">{hint}</span>
      )}
    </DropdownMenuItem>
  );
}

function LabelledGroup({
  label,
  actions,
  props,
}: {
  label: string;
  actions: readonly DeckMenuAction[];
  props: DeckMenuContentProps;
}) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      {actions.map((action) => (
        <ActionItem key={action} action={action} props={props} />
      ))}
    </DropdownMenuGroup>
  );
}

function FormatItems({ props }: { props: DeckMenuContentProps }) {
  return props.formats.map((entry) => (
    <DropdownMenuItem key={entry.slug} onClick={() => props.onFormat?.(entry.slug, entry.label)}>
      {entry.label}
    </DropdownMenuItem>
  ));
}

function FolderItems({ props }: { props: DeckMenuContentProps }) {
  const folders = props.folders ?? [];
  return (
    <>
      {folders.map((folder) => (
        <DropdownMenuCheckboxItem
          key={folder.id}
          checked={folder.checked}
          onClick={() => props.onToggleFolder?.(folder.id)}
        >
          {folder.name}
        </DropdownMenuCheckboxItem>
      ))}
      {folders.length > 0 && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={() => props.onManageFolders?.()}>
        <SettingsIcon />
        {m.decks_menu_manage_folders()}
      </DropdownMenuItem>
    </>
  );
}

function SubViewItems({
  view,
  props,
  nested,
}: {
  view: SubView;
  props: DeckMenuContentProps;
  nested: (child: "format" | "folders") => ReactNode;
}) {
  const manage = props.model.manage;
  if (view === "format") {
    return <FormatItems props={props} />;
  }
  if (view === "folders") {
    return <FolderItems props={props} />;
  }
  const actions = manage ? manage[view] : [];
  const lastAction = view === "edit" ? "importReplace" : view === "copies" ? "variants" : "archive";
  return actions.map((action) => (
    <SubViewEntry
      key={action}
      action={action}
      props={props}
      nested={nested}
      split={action === lastAction}
    />
  ));
}

function SubViewEntry({
  action,
  props,
  nested,
  split,
}: {
  action: DeckMenuAction;
  props: DeckMenuContentProps;
  nested: (child: "format" | "folders") => ReactNode;
  split: boolean;
}) {
  const entry =
    action === "changeFormat" ? (
      nested("format")
    ) : action === "folders" ? (
      nested("folders")
    ) : (
      <ActionItem action={action} props={props} />
    );
  return (
    <>
      {split && <DropdownMenuSeparator />}
      {entry}
    </>
  );
}

function FlyoutSub({ view, props }: { view: SubView; props: DeckMenuContentProps }) {
  const { icon: Icon, label } = subViewLook(view, props.context);
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <SubViewItems
          view={view}
          props={props}
          nested={(child) => <FlyoutSub view={child} props={props} />}
        />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DrillTrigger({
  view,
  props,
  onOpen,
}: {
  view: SubView;
  props: DeckMenuContentProps;
  onOpen: (view: SubView) => void;
}) {
  const { icon: Icon, label } = subViewLook(view, props.context);
  return (
    <DropdownMenuItem
      closeOnClick={false}
      aria-haspopup="menu"
      data-drill-view={view}
      onClick={() => onOpen(view)}
    >
      <Icon />
      {label}
      <ChevronRightIcon className="text-muted-foreground ml-auto" />
    </DropdownMenuItem>
  );
}

function RootItems({
  props,
  sub,
}: {
  props: DeckMenuContentProps;
  sub: (view: SubView) => ReactNode;
}) {
  const { model, prefix } = props;
  const manage = model.manage;
  return (
    <>
      {prefix}
      {model.open.map((action) => (
        <ActionItem key={action} action={action} props={props} />
      ))}
      <LabelledGroup label={m.decks_menu_group_share()} actions={model.share} props={props} />
      <LabelledGroup label={m.decks_menu_group_copy_as()} actions={model.copy} props={props} />
      <LabelledGroup label={m.decks_menu_group_print()} actions={model.print} props={props} />
      {manage && (
        <>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{m.decks_menu_group_manage()}</DropdownMenuLabel>
            {manage.storedIn && <ActionItem action="storedIn" props={props} />}
            {sub("edit")}
            {manage.directDuplicate ? (
              <ActionItem action="duplicate" props={props} />
            ) : (
              sub("copies")
            )}
            {manage.organize.length > 0 && sub("organize")}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {manage.unarchive && <ActionItem action="unarchive" props={props} />}
          <ActionItem action="delete" props={props} />
        </>
      )}
    </>
  );
}

function DrillInMenu({ props }: { props: DeckMenuContentProps }) {
  const [view, setView] = useState<SubView | null>(null);
  const focusTarget = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const go = (next: SubView | null) => {
    focusTarget.current = '[role^="menuitem"]';
    setView(next);
  };
  const back = (from: SubView) => {
    focusTarget.current = `[data-drill-view="${from}"]`;
    setView(PARENT_VIEW[from]);
  };

  useEffect(() => {
    const target = focusTarget.current;
    if (target === null) {
      return;
    }
    focusTarget.current = null;
    containerRef.current?.querySelector<HTMLElement>(target)?.focus();
  });

  const open = (child: SubView) => <DrillTrigger view={child} props={props} onOpen={go} />;

  return (
    <div ref={containerRef}>
      {view === null ? (
        <RootItems props={props} sub={open} />
      ) : (
        <>
          <DropdownMenuItem closeOnClick={false} onClick={() => back(view)}>
            <ChevronLeftIcon />
            {m.decks_menu_back()}
          </DropdownMenuItem>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{subViewLook(view, props.context).label}</DropdownMenuLabel>
            <SubViewItems view={view} props={props} nested={open} />
          </DropdownMenuGroup>
        </>
      )}
    </div>
  );
}

export function DeckMenuContent(props: DeckMenuContentProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrillInMenu props={props} />;
  }
  return <RootItems props={props} sub={(view) => <FlyoutSub view={view} props={props} />} />;
}
