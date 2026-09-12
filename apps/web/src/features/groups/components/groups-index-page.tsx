import { Link, useNavigate } from "@tanstack/react-router";
import { PlusIcon, UsersIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { Heading } from "@/components/heading";
import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarPrimaryButton,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card-link";
import { CardRow } from "@/components/ui/card-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/ui/section-heading";
import { Switch } from "@/components/ui/switch";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { CardArtThumbStack } from "@/features/cards/components/card-art-thumb-stack";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { useTradeActionCounts, useUserTrades } from "@/features/groups/hooks/use-card-trades";
import {
  useCreateFriendGroup,
  useDeclineFriendGroupInvite,
} from "@/features/groups/hooks/use-friend-group-mutations";
import {
  useFriendGroupMatchPanels,
  useFriendGroups,
} from "@/features/groups/hooks/use-friend-groups";
import { GROUP_BANNER_FRAME, GROUP_BANNER_WASH } from "@/features/groups/lib/banner-frame";
import { tradeVolumeLabel } from "@/features/groups/lib/friend-group-activity";
import { deriveGroupSlug, groupSlugError } from "@/features/groups/lib/group-slug";
import type { GroupSuggestionStrip } from "@/features/groups/lib/trade-derivation";
import { groupSuggestionStripsBySlug } from "@/features/groups/lib/trade-derivation";
import { useRequiredUserId } from "@/lib/auth-session";
import { markdownTeaser } from "@/lib/markdown-teaser";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ShareListsWithGroupDialog } from "./share-lists-with-group-dialog";

const MAX_THUMBS = 5;

function SuggestionStrip({
  strip,
  label,
  printingsById,
}: {
  strip: GroupSuggestionStrip | undefined;
  label: string;
  printingsById: ReturnType<typeof useCards>["printingsById"];
}) {
  if (strip === undefined || strip.count === 0) {
    return null;
  }
  const items = strip.printingIds.map((printingId) => ({
    key: printingId,
    imageId: frontImageId(printingsById[printingId]),
  }));
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <CardArtThumbStack items={items} max={MAX_THUMBS} thumbClassName="w-8" />
      <span className="text-muted-foreground min-w-0 truncate text-sm">
        <span className="text-foreground font-medium">{strip.count}</span> {label}
      </span>
    </div>
  );
}

function GroupTileBanner({ url, position }: { url: string | null; position: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn(GROUP_BANNER_FRAME, "-mx-5 -mt-5 overflow-hidden")}
      style={url ? undefined : { backgroundImage: GROUP_BANNER_WASH }}
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `50% ${position}%` }}
        />
      ) : null}
    </div>
  );
}

function CreateGroupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (group: { slug: string; name: string }) => void;
}) {
  const createGroup = useCreateFriendGroup();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [generateCode, setGenerateCode] = useState(true);
  // Follows the name until someone edits the slug directly; clearing it
  // hands control back to the name.
  const effectiveSlug = slugEdited ? slug : deriveGroupSlug(name);
  const slugError = groupSlugError(effectiveSlug);

  async function handleCreate() {
    if (!name.trim() || !effectiveSlug || slugError) {
      return;
    }
    const trimmedName = name.trim();
    const payload = {
      name: trimmedName,
      slug: effectiveSlug,
      description: description.trim() || null,
      generateCode,
    };
    try {
      const group = await createGroup.mutateAsync(payload);
      onOpenChange(false);
      onCreated({ slug: group.slug, name: trimmedName });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogForm onSubmit={() => void handleCreate()}>
          <DialogHeader>
            <DialogTitle>{m.groups_create_title()}</DialogTitle>
            <DialogDescription>{m.groups_create_description()}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fg-name">{m.common_name()}</Label>
              <Input
                id="fg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder={m.groups_create_name_placeholder()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fg-slug">{m.groups_create_slug_label()}</Label>
              <Input
                id="fg-slug"
                value={effectiveSlug}
                onChange={(e) => {
                  const next = e.target.value.toLowerCase();
                  setSlugEdited(next.length > 0);
                  setSlug(next);
                }}
                maxLength={30}
                placeholder={m.groups_create_slug_placeholder()}
              />
              {slugError ? (
                <FieldError className="text-xs">{slugError}</FieldError>
              ) : (
                <span className="text-muted-foreground text-xs">
                  {m.groups_create_slug_hint({
                    slug: effectiveSlug || m.groups_create_slug_hint_fallback(),
                  })}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fg-desc">{m.groups_create_description_label()}</Label>
              <Textarea
                id="fg-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <span className="text-muted-foreground text-xs">{m.groups_markdown_hint()}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="fg-invite">{m.groups_invite_link_label()}</Label>
                <span className="text-muted-foreground text-xs">
                  {m.groups_create_invite_hint()}
                </span>
              </div>
              <Switch id="fg-invite" checked={generateCode} onCheckedChange={setGenerateCode} />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                !name.trim() || !effectiveSlug || Boolean(slugError) || createGroup.isPending
              }
            >
              {m.common_create()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}

export function GroupsIndexPage() {
  const { data } = useFriendGroups();
  const { data: actionCounts } = useTradeActionCounts();
  const actionCountByGroup = new Map(
    (actionCounts?.byGroup ?? []).map((entry) => [entry.groupId, entry]),
  );
  // Matching is expensive; it's queried per group here, so cards paint first
  // and each strip arrives when its group answers.
  const { data: allTradesData } = useUserTrades();
  const matchPanels = useFriendGroupMatchPanels(data.items.map((row) => row.slug));
  const stripsBySlug = groupSuggestionStripsBySlug(matchPanels, allTradesData?.items ?? []);
  const { printingsById } = useCards();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  // navigateOnClose lands the creator inside their new group once the
  // share-lists prompt is dismissed.
  const [shareWithGroup, setShareWithGroup] = useState<{
    slug: string;
    name: string;
    navigateOnClose: boolean;
  } | null>(null);
  const declineInvite = useDeclineFriendGroupInvite();
  const viewerId = useRequiredUserId();

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.groups_index_title()}</PageTopBarTitle>
          <PageTopBarActions>
            <PageTopBarPrimaryButton onClick={() => setCreateOpen(true)}>
              <PlusIcon className="size-4" />
              {m.groups_index_new()}
            </PageTopBarPrimaryButton>
            <CreateGroupDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              onCreated={(group) =>
                setShareWithGroup({ slug: group.slug, name: group.name, navigateOnClose: true })
              }
            />
          </PageTopBarActions>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        {data.outgoingRequests.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionHeading>{m.groups_index_awaiting_approval()}</SectionHeading>
            <ul className="flex flex-col gap-2">
              {data.outgoingRequests.map((request) => (
                <CardRow key={request.id}>
                  <Link
                    to="/groups/$slug"
                    params={{ slug: request.groupSlug }}
                    className="flex min-w-0 flex-col"
                  >
                    <span className="truncate font-medium hover:underline">
                      {request.groupName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {request.memberCount === 1
                        ? m.groups_member_count_one({ count: request.memberCount })
                        : m.groups_member_count_other({ count: request.memberCount })}
                    </span>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      declineInvite.mutate({ slug: request.groupSlug, userId: viewerId })
                    }
                    disabled={declineInvite.isPending}
                  >
                    <XIcon className="size-4" />
                    {m.groups_cancel_request()}
                  </Button>
                </CardRow>
              ))}
            </ul>
          </section>
        )}

        {data.items.length === 0 ? (
          <EmptyState
            className="py-12"
            icon={UsersIcon}
            title={m.groups_index_empty_title()}
            description={
              <>
                {m.groups_index_empty_description()}{" "}
                <TextLink render={<Link to="/help/$slug" params={{ slug: "groups" }} />}>
                  {m.groups_index_empty_link()}
                </TextLink>
              </>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {data.items.map((row) => {
              const actions = actionCountByGroup.get(row.id);
              const respondCount = actions?.respondCount ?? 0;
              const settleCount = actions?.settleCount ?? 0;
              const needsViewer = (actions?.count ?? 0) > 0 || row.pendingRequestCount > 0;
              const strips = stripsBySlug.get(row.slug);
              const teaser = markdownTeaser(row.description);
              return (
                <CardLink
                  key={row.id}
                  render={<Link to="/groups/$slug" params={{ slug: row.slug }} />}
                  className={cn(
                    "flex-col gap-2.5 p-5",
                    needsViewer && "ring-primary/40 hover:ring-primary/50",
                  )}
                >
                  <GroupTileBanner url={row.bannerUrl} position={row.bannerPosition} />
                  <div className="flex min-w-0 items-center gap-2">
                    <Heading className="min-w-0 flex-1 truncate">{row.name}</Heading>
                    <UserAvatarStack
                      members={row.memberPreviews}
                      totalCount={row.memberCount}
                      size="sm"
                      className="shrink-0"
                    />
                  </div>
                  {respondCount > 0 || settleCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {respondCount > 0 ? (
                        <Badge className="whitespace-nowrap">
                          {respondCount === 1
                            ? m.groups_index_trade_requests_one({ count: respondCount })
                            : m.groups_index_trade_requests_other({ count: respondCount })}
                        </Badge>
                      ) : null}
                      {settleCount > 0 ? (
                        <Badge variant="subtle" className="whitespace-nowrap">
                          {settleCount === 1
                            ? m.groups_index_swaps_to_confirm_one({ count: settleCount })
                            : m.groups_index_swaps_to_confirm_other({ count: settleCount })}
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {row.pendingRequestCount > 0 ? (
                    <span className="text-primary text-sm font-medium">
                      {row.pendingRequestCount === 1
                        ? m.groups_index_requests_to_review_one({
                            count: row.pendingRequestCount,
                          })
                        : m.groups_index_requests_to_review_other({
                            count: row.pendingRequestCount,
                          })}
                    </span>
                  ) : null}
                  <SuggestionStrip
                    strip={strips?.incoming}
                    label={m.groups_index_strip_incoming()}
                    printingsById={printingsById}
                  />
                  <SuggestionStrip
                    strip={strips?.outgoing}
                    label={m.groups_index_strip_outgoing()}
                    printingsById={printingsById}
                  />
                  {teaser ? (
                    <p className="text-muted-foreground line-clamp-2 text-sm">{teaser}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-1.5 text-sm">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        row.recentTradedCardCount > 0 ? "bg-success" : "bg-muted-foreground/50",
                      )}
                    />
                    {tradeVolumeLabel(row.recentTradedCardCount, row.tradedCardCount)}
                  </p>
                </CardLink>
              );
            })}
          </div>
        )}
      </div>
      {shareWithGroup && (
        <ShareListsWithGroupDialog
          slug={shareWithGroup.slug}
          groupName={shareWithGroup.name}
          open
          onOpenChange={(open) => {
            if (!open) {
              if (shareWithGroup.navigateOnClose) {
                void navigate({ to: "/groups/$slug", params: { slug: shareWithGroup.slug } });
              }
              setShareWithGroup(null);
            }
          }}
        />
      )}
    </>
  );
}
