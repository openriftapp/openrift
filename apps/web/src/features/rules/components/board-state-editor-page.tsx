import { boardDocumentSchema, emptyBoardDocument } from "@openrift/shared/board-state";
import type { BoardStateResponse } from "@openrift/shared/types/api/board-state";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarButton,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Skeleton } from "@/components/ui/skeleton";
import type { EditorMeta } from "@/features/rules/components/board-state-editor-workspace";
import {
  BoardWorkspace,
  SetupPane,
} from "@/features/rules/components/board-state-editor-workspace";
import {
  useCreateBoardState,
  useDeleteBoardState,
  useSetBoardStateShare,
  useUpdateBoardState,
} from "@/features/rules/hooks/use-board-states";
import { ruleVersionsQueryOptions } from "@/features/rules/lib/rules-queries";
import { useBoardDraftStore } from "@/features/rules/stores/board-draft-store";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/lib/auth-session";
import { getSiteUrl } from "@/lib/site-config";
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
    answer: boardState.answer ?? "",
    coreRulesVersion: boardState.coreRulesVersion,
    tournamentRulesVersion: boardState.tournamentRulesVersion,
  });
  const [metaDirty, setMetaDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documentDirty = useBoardEditorStore((state) => state.dirty);
  const update = useUpdateBoardState();
  const remove = useDeleteBoardState();
  const share = useSetBoardStateShare();
  const { copy, copied } = useCopyToClipboard();
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

  const shared = boardState.shareToken !== null && boardState.isPublic;
  const shareToken = boardState.shareToken;

  return (
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
          {shared && shareToken ? (
            <>
              <PageTopBarButton
                render={
                  <Link to="/board/$token" params={{ token: shareToken }}>
                    {m.board_states_editor_view()}
                  </Link>
                }
              />
              <PageTopBarButton onClick={() => void copy(`${getSiteUrl()}/board/${shareToken}`)}>
                {copied ? m.board_states_editor_link_copied() : m.board_states_editor_copy_link()}
              </PageTopBarButton>
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
          <PageTopBarButton
            disabled={remove.isPending}
            onClick={() => {
              if (!globalThis.confirm(m.board_states_editor_delete_confirm())) {
                return;
              }
              void (async () => {
                try {
                  await remove.mutateAsync(boardState.id);
                  await navigate({ to: "/board-states" });
                } catch {
                  /* Reported by the global mutation error toast. */
                }
              })();
            }}
          >
            <Trash2Icon />
            {m.board_states_editor_delete()}
          </PageTopBarButton>
          <PageTopBarPrimaryButton
            disabled={update.isPending || !dirty}
            onClick={() => void save()}
          >
            {m.board_states_editor_save()}
          </PageTopBarPrimaryButton>
        </>
      }
    />
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
          answer: draft.answer,
          coreRulesVersion: draft.coreRulesVersion,
          tournamentRulesVersion: draft.tournamentRulesVersion,
        }
      : {
          title: m.board_states_untitled(),
          answer: "",
          coreRulesVersion: latestCore?.version ?? null,
          tournamentRulesVersion: null,
        };
  });
  const [error, setError] = useState<string | null>(null);

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
      await navigate({ to: "/login", search: { redirect: "/board-states/new", email: undefined } });
      return;
    }
    const title = meta.title.trim() === "" ? m.board_states_untitled() : meta.title;
    try {
      const created = await create.mutateAsync({ ...meta, title, document: result.document });
      clearDraft();
      useBoardEditorStore.setState({ dirty: false });
      await navigate({
        to: "/board-states/$boardStateId",
        params: { boardStateId: created.id },
      });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  };

  return (
    <EditorLayout
      meta={meta}
      error={error}
      notice={userId ? null : m.board_states_editor_draft_kept()}
      onMeta={setMeta}
      actions={
        <PageTopBarPrimaryButton disabled={create.isPending} onClick={() => void save()}>
          {userId ? m.board_states_editor_save() : m.board_states_editor_sign_in_to_save()}
        </PageTopBarPrimaryButton>
      }
    />
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
  return (
    <>
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarTitle>{meta.title || m.board_states_untitled()}</PageTopBarTitle>
          <PageTopBarActions>{actions}</PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP, "flex flex-col gap-3 pt-3 pb-8")}>
        {error ? <p className="text-destructive">{error}</p> : null}
        {notice ? <p className="text-muted-foreground">{notice}</p> : null}
        <p className="text-muted-foreground lg:hidden">{m.board_states_editor_desktop_only()}</p>
        <div className="hidden gap-4 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)_18rem]">
          <SetupPane meta={meta} onMeta={onMeta} />
          <BoardWorkspace />
        </div>
      </div>
    </>
  );
}
