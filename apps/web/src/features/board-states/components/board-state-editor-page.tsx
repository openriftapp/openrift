import {
  boardDocumentSchema,
  emptyBoardDocument,
  extractRuleRefs,
} from "@openrift/shared/board-state";
import type { BoardStateResponse } from "@openrift/shared/types/api/board-state";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisVerticalIcon, EyeIcon, PencilIcon, Trash2Icon, UndoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { flushSync } from "react-dom";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { CopyTextButton } from "@/components/copy-text-button";
import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { ruleRefLabel } from "@/features/board-states/components/board-caption-text";
import { BoardEditorPreview } from "@/features/board-states/components/board-editor-preview";
import { BoardEditorRulesPopover } from "@/features/board-states/components/board-editor-rules-popover";
import { BoardEditorTitleDialog } from "@/features/board-states/components/board-editor-title-dialog";
import type { EditorMeta } from "@/features/board-states/components/board-state-editor-workspace";
import { BoardWorkspace } from "@/features/board-states/components/board-state-editor-workspace";
import {
  useCreateBoardState,
  useDeleteBoardState,
  useSetBoardStateShare,
  useUpdateBoardState,
} from "@/features/board-states/hooks/use-board-states";
import { useBoardDraftStore } from "@/features/board-states/stores/board-draft-store";
import { useBoardEditorStore } from "@/features/board-states/stores/board-editor-store";
import { unknownRuleRefs, useKnownRules } from "@/features/rules/hooks/use-known-rules";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/hooks/use-session";
import { shareLinkUrl } from "@/lib/share-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function validDocument(): { error: string } | { document: BoardStateResponse["document"] } {
  const parsed = boardDocumentSchema.safeParse(useBoardEditorStore.getState().document);
  if (!parsed.success) {
    return {
      error: m.board_states_editor_invalid({ message: parsed.error.issues[0]?.message ?? "" }),
    };
  }
  return { document: parsed.data };
}

function HydratedEditor({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <Skeleton className="m-6 h-96" />;
  }
  return <Suspense fallback={<Skeleton className="m-6 h-96" />}>{children}</Suspense>;
}

export function BoardStateEditorPage({ boardState }: { boardState: BoardStateResponse }) {
  // oxlint-disable-next-line react/hook-use-state -- run-once init, the value itself is unused
  useState(() => {
    useBoardEditorStore.getState().load(boardState.document);
    return true;
  });
  return (
    <HydratedEditor>
      <SavedEditor boardState={boardState} />
    </HydratedEditor>
  );
}

export function NewBoardStatePage() {
  return (
    <HydratedEditor>
      <DraftEditor />
    </HydratedEditor>
  );
}

function SavedEditor({ boardState }: { boardState: BoardStateResponse }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<EditorMeta>({
    title: boardState.title,
    coreRulesVersion: boardState.coreRulesVersion,
    tournamentRulesVersion: boardState.tournamentRulesVersion,
  });
  const [metaDirty, setMetaDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentDirty = useBoardEditorStore((state) => state.dirty);
  const update = useUpdateBoardState();
  const remove = useDeleteBoardState();
  const share = useSetBoardStateShare();
  const dirty = metaDirty || documentDirty;

  const save = async () => {
    const result = validDocument();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (meta.coreRulesVersion === null && meta.tournamentRulesVersion === null) {
      setError(m.board_states_editor_rules_required());
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({ id: boardState.id, ...meta, document: result.document });
      setMetaDirty(false);
      useBoardEditorStore.setState({ dirty: false });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  };

  const shareUrl = shareLinkUrl("board", boardState);
  const shareToken = boardState.shareToken;

  return (
    <>
      <UnsavedChangesGuard dirty={dirty} />
      <EditorLayout
        meta={meta}
        error={error}
        onMeta={(next) => {
          setMeta(next);
          setMetaDirty(true);
        }}
        actions={
          <>
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {dirty ? m.board_states_editor_unsaved() : m.board_states_editor_saved()}
            </span>
            {shareUrl && shareToken ? (
              <>
                <Link
                  to="/board/$token"
                  params={{ token: shareToken }}
                  className={buttonVariants({ variant: "ghost" })}
                >
                  {m.board_states_editor_view()}
                </Link>
                <CopyTextButton
                  variant="ghost"
                  label={m.board_states_editor_copy_link()}
                  value={shareUrl}
                />
                <PageTopBarButton
                  disabled={share.isPending}
                  onClick={() => share.mutate({ id: boardState.id, shared: false })}
                >
                  {m.board_states_editor_share_disable()}
                </PageTopBarButton>
              </>
            ) : (
              <PageTopBarButton
                disabled={share.isPending}
                onClick={() => share.mutate({ id: boardState.id, shared: true })}
              >
                {m.board_states_editor_share_enable()}
              </PageTopBarButton>
            )}
            <ConfirmActionButton
              trigger={<PageTopBarButton />}
              disabled={remove.isPending}
              title={m.board_states_editor_delete_title()}
              description={m.board_states_editor_delete_description()}
              confirmLabel={m.board_states_editor_delete()}
              onConfirm={async () => {
                await remove.mutateAsync(boardState.id);
                flushSync(() => {
                  setMetaDirty(false);
                  useBoardEditorStore.setState({ dirty: false });
                });
                await navigate({ to: "/board-states" });
              }}
            >
              <Trash2Icon />
              {m.board_states_editor_delete()}
            </ConfirmActionButton>
            <PageTopBarPrimaryButton
              pending={update.isPending}
              disabled={!dirty}
              onClick={() => void save()}
            >
              {m.board_states_editor_save()}
            </PageTopBarPrimaryButton>
          </>
        }
      />
    </>
  );
}

function DraftEditor() {
  const navigate = useNavigate();
  const userId = useUserId();
  const create = useCreateBoardState();
  const saveDraft = useBoardDraftStore((state) => state.saveDraft);
  const clearDraft = useBoardDraftStore((state) => state.clearDraft);
  const latestCore = useSuspenseQuery(ruleVersionsQueryOptions("core")).data.versions.at(-1);
  const [meta, setMeta] = useState<EditorMeta>(() => {
    const draft = useBoardDraftStore.getState().draft;
    useBoardEditorStore.getState().load(draft?.document ?? emptyBoardDocument());
    return draft
      ? {
          title: draft.title,
          coreRulesVersion: draft.coreRulesVersion,
          tournamentRulesVersion: draft.tournamentRulesVersion,
        }
      : {
          title: m.board_states_untitled(),
          coreRulesVersion: latestCore?.version ?? null,
          tournamentRulesVersion: null,
        };
  });
  const [error, setError] = useState<string | null>(null);
  const [metaDirty, setMetaDirty] = useState(false);
  const documentDirty = useBoardEditorStore((state) => state.dirty);
  const dirty = metaDirty || documentDirty;

  const markClean = () => {
    flushSync(() => {
      setMetaDirty(false);
      useBoardEditorStore.setState({ dirty: false });
    });
  };

  const save = async () => {
    const result = validDocument();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (meta.coreRulesVersion === null && meta.tournamentRulesVersion === null) {
      setError(m.board_states_editor_rules_required());
      return;
    }
    setError(null);
    if (!userId) {
      saveDraft({ ...meta, document: result.document });
      markClean();
      await navigate({ to: "/login", search: { redirect: "/board-states/new", email: undefined } });
      return;
    }
    const title = meta.title.trim() === "" ? m.board_states_untitled() : meta.title;
    try {
      const created = await create.mutateAsync({ ...meta, title, document: result.document });
      clearDraft();
      markClean();
      await navigate({
        to: "/board-states/$boardStateId",
        params: { boardStateId: created.id },
      });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  };

  return (
    <>
      <UnsavedChangesGuard dirty={dirty} />
      <EditorLayout
        meta={meta}
        error={error}
        notice={userId ? null : m.board_states_editor_draft_kept()}
        onMeta={(next) => {
          setMeta(next);
          setMetaDirty(true);
        }}
        actions={
          <PageTopBarPrimaryButton pending={create.isPending} onClick={() => void save()}>
            {userId ? m.board_states_editor_save() : m.board_states_editor_sign_in_to_save()}
          </PageTopBarPrimaryButton>
        }
      />
    </>
  );
}

function EditorLayout({
  meta,
  error,
  notice,
  onMeta,
  actions,
}: {
  meta: EditorMeta;
  error: string | null;
  notice?: string | null;
  onMeta: (meta: EditorMeta) => void;
  actions: ReactNode;
}) {
  const [preview, setPreview] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [hideEmptyZones, setHideEmptyZones] = useState(false);
  const undo = useBoardEditorStore((state) => state.undo);
  const canUndo = useBoardEditorStore((state) => state.history.length > 0);
  const steps = useBoardEditorStore((state) => state.document.steps);
  const knownRules = useKnownRules(meta);
  const unknown = unknownRuleRefs(
    extractRuleRefs(steps.map((step) => step.caption).join("\n")),
    knownRules,
  );
  return (
    <>
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarTitle>{meta.title || m.board_states_untitled()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarButton disabled={!canUndo} onClick={undo}>
              <UndoIcon />
              {m.board_states_editor_undo()}
            </PageTopBarButton>
            <PageTopBarButton onClick={() => setPreview(!preview)}>
              {preview ? <PencilIcon /> : <EyeIcon />}
              {preview ? m.board_states_editor_preview_exit() : m.board_states_editor_preview()}
            </PageTopBarButton>
            <BoardEditorRulesPopover
              coreRulesVersion={meta.coreRulesVersion}
              tournamentRulesVersion={meta.tournamentRulesVersion}
              onChange={(pins) => onMeta({ ...meta, ...pins })}
            />
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger render={<PageTopBarIconButton />}>
                <EllipsisVerticalIcon className="size-4" />
                <span className="sr-only">{m.board_states_editor_more()}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <PencilIcon />
                  {m.board_states_editor_rename()}
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={hideEmptyZones}
                  onCheckedChange={setHideEmptyZones}
                >
                  {m.board_states_editor_hide_empty()}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP, "flex flex-col gap-3 pt-3 pb-8")}>
        {error ? <p className="text-destructive">{error}</p> : null}
        {unknown.length > 0 ? (
          <p className="text-destructive">
            {m.board_states_editor_unknown_rules({
              rules: unknown.map((reference) => ruleRefLabel(reference)).join(", "),
            })}
          </p>
        ) : null}
        {notice ? <p className="text-muted-foreground">{notice}</p> : null}
        <p className="text-muted-foreground lg:hidden">{m.board_states_editor_desktop_only()}</p>
        <div className="hidden flex-col gap-4 lg:flex">
          {preview ? (
            <BoardEditorPreview
              pins={{
                coreRulesVersion: meta.coreRulesVersion,
                tournamentRulesVersion: meta.tournamentRulesVersion,
              }}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
              <BoardWorkspace hideEmptyZones={hideEmptyZones} />
            </div>
          )}
        </div>
      </div>
      <BoardEditorTitleDialog
        title={meta.title}
        open={renaming}
        onOpenChange={setRenaming}
        onTitle={(title) => onMeta({ ...meta, title })}
      />
    </>
  );
}
