import type {
  TournamentDetailResponse,
  TournamentStaffMemberResponse,
  TournamentStaffRole,
} from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import {
  EllipsisVerticalIcon,
  GavelIcon,
  LinkIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { ActionBand } from "@/components/ui/action-band";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { ShareLinkRow } from "@/features/groups/components/share-link-row";
import {
  useAddTournamentStaff,
  useRemoveTournamentStaff,
  useSetTournamentStaffInvite,
} from "@/features/tournaments/hooks/use-tournament-mutations";
import { useTournamentStaffCandidates } from "@/features/tournaments/hooks/use-tournaments";
import { isTournamentHost, staffRoleLabels } from "@/features/tournaments/lib/tournament-display";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

function roleItems(): { value: TournamentStaffRole; label: string }[] {
  const labels = staffRoleLabels();
  return [
    { value: "organizer", label: labels.organizer },
    { value: "judge", label: labels.judge },
  ];
}

function orgRoleLabels(): Record<"owner" | "manager" | "judge", string> {
  return {
    owner: m.tournaments_staff_org_role_owner(),
    manager: m.tournaments_staff_org_role_manager(),
    judge: m.tournaments_lib_staff_role_judge(),
  };
}

function roleSections(): Record<
  TournamentStaffRole,
  {
    heading: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    empty: string;
    emptyHint: string;
  }
> {
  return {
    organizer: {
      heading: m.tournaments_staff_organizers_heading(),
      icon: ShieldIcon,
      empty: m.tournaments_staff_empty_organizers(),
      emptyHint: m.tournaments_staff_empty_hint_organizer(),
    },
    judge: {
      heading: m.tournaments_staff_judges_heading(),
      icon: GavelIcon,
      empty: m.tournaments_staff_empty_judges(),
      emptyHint: m.tournaments_staff_empty_hint_judge(),
    },
  };
}

export function TournamentStaffTab({ detail }: { detail: TournamentDetailResponse }) {
  const host = isTournamentHost(detail.myRoles);

  return (
    <div className="flex flex-col gap-6">
      <StaffRoleSection detail={detail} staffRole="organizer" host={host} />
      <StaffRoleSection detail={detail} staffRole="judge" host={host} />

      {detail.host.type === "organization" && detail.host.orgId ? (
        <p className="text-muted-foreground text-sm">
          {m.tournaments_staff_org_note_prefix()}
          <Link
            to="/organizations/$id"
            params={{ id: detail.host.orgId }}
            className="font-medium underline"
          >
            {detail.host.displayName}
          </Link>
          {m.tournaments_staff_org_note_suffix()}
        </p>
      ) : null}

      {host ? <StaffInviteBand detail={detail} /> : null}
    </div>
  );
}

function StaffRoleSection({
  detail,
  staffRole,
  host,
}: {
  detail: TournamentDetailResponse;
  staffRole: TournamentStaffRole;
  host: boolean;
}) {
  const section = roleSections()[staffRole];
  const members = detail.staff.filter((member) => member.role === staffRole);

  return (
    <section className="flex flex-col gap-3">
      <SectionHeading count={members.length}>{section.heading}</SectionHeading>
      {members.length === 0 ? (
        <Empty className="py-8">
          <EmptyHeader>
            <EmptyMedia>
              <section.icon className="text-muted-foreground size-8" />
            </EmptyMedia>
            <EmptyDescription>
              {section.empty}
              {host ? section.emptyHint : "."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <RowList>
          {members.map((member) => (
            <StaffRow
              key={`${member.userId}-${member.source}-${member.role}`}
              detail={detail}
              member={member}
              host={host}
            />
          ))}
        </RowList>
      )}
    </section>
  );
}

function StaffRow({
  detail,
  member,
  host,
}: {
  detail: TournamentDetailResponse;
  member: TournamentStaffMemberResponse;
  host: boolean;
}) {
  const removeStaff = useRemoveTournamentStaff();
  const canRemove = host && member.source === "grant";

  async function handleRemove() {
    try {
      await removeStaff.mutateAsync({ id: detail.id, userId: member.userId, role: member.role });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <RowListItem>
      <UserAvatar name={member.name} className="size-9 shrink-0" />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">{member.name ?? member.userId}</span>
        {member.source === "organization" && member.orgRole ? (
          <Badge
            variant="subtle"
            className="shrink-0"
            title={m.tournaments_staff_org_role_title({
              role: orgRoleLabels()[member.orgRole],
              org: detail.host.displayName,
            })}
          >
            {m.tournaments_staff_via_org()}
          </Badge>
        ) : null}
      </span>
      {canRemove ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={m.tournaments_staff_actions_aria()}
              />
            }
          >
            <EllipsisVerticalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              disabled={removeStaff.isPending}
              onClick={() => void handleRemove()}
            >
              <Trash2Icon className="size-4" />
              {m.tournaments_roster_remove()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : host ? (
        // Keeps the name column aligned with rows that do have a menu.
        <span aria-hidden="true" className="size-7 shrink-0" />
      ) : null}
    </RowListItem>
  );
}

function StaffInviteBand({ detail }: { detail: TournamentDetailResponse }) {
  const activeCount = [detail.organizerInviteToken, detail.judgeInviteToken].filter(
    (token) => token !== null,
  ).length;

  return (
    <ActionBand
      icon={LinkIcon}
      label={m.tournaments_staff_invite_links_label()}
      value={activeCount}
      sub={m.tournaments_staff_invite_links_sub()}
    >
      <div className="flex flex-col gap-2">
        <StaffInviteRow id={detail.id} staffRole="organizer" token={detail.organizerInviteToken} />
        <StaffInviteRow id={detail.id} staffRole="judge" token={detail.judgeInviteToken} />
      </div>
    </ActionBand>
  );
}

function StaffInviteRow({
  id,
  staffRole,
  token,
}: {
  id: string;
  staffRole: TournamentStaffRole;
  token: string | null;
}) {
  const setInvite = useSetTournamentStaffInvite();
  const [disableOpen, setDisableOpen] = useState(false);
  const judge = staffRole === "judge";
  const roleLabel = staffRoleLabels()[staffRole];
  const url = token ? `${getSiteUrl()}/tournaments/staff-invite/${token}` : null;

  async function run(enabled: boolean) {
    try {
      await setInvite.mutateAsync({ id, role: staffRole, enabled });
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  async function handleDisable() {
    await run(false);
    setDisableOpen(false);
  }

  return (
    <Callout variant="inset" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0">
          {roleLabel}
        </Badge>
        {url ? null : (
          <>
            <span className="text-muted-foreground text-xs">
              {m.tournaments_staff_no_link_yet()}
            </span>
            <Button
              size="sm"
              className="ml-auto"
              aria-label={
                judge
                  ? m.tournaments_staff_create_link_aria_judge()
                  : m.tournaments_staff_create_link_aria_organizer()
              }
              disabled={setInvite.isPending}
              onClick={() => void run(true)}
            >
              {m.tournaments_staff_create_link()}
            </Button>
          </>
        )}
      </div>
      {url ? (
        <>
          <ShareLinkRow
            url={url}
            label={m.tournaments_staff_invite_link_label({ role: roleLabel })}
            actions={
              <Button
                variant="ghost"
                className="text-destructive"
                aria-label={
                  judge
                    ? m.tournaments_staff_disable_aria_judge()
                    : m.tournaments_staff_disable_aria_organizer()
                }
                disabled={setInvite.isPending}
                onClick={() => setDisableOpen(true)}
              >
                {m.tournaments_staff_disable()}
              </Button>
            }
          />
          <ConfirmActionDialog
            open={disableOpen}
            onOpenChange={setDisableOpen}
            title={
              judge
                ? m.tournaments_staff_disable_title_judge()
                : m.tournaments_staff_disable_title_organizer()
            }
            description={
              judge
                ? m.tournaments_staff_disable_description_judge()
                : m.tournaments_staff_disable_description_organizer()
            }
            confirmLabel={m.tournaments_staff_disable_link()}
            pendingLabel={m.tournaments_staff_disabling()}
            isPending={setInvite.isPending}
            onConfirm={() => void handleDisable()}
          />
        </>
      ) : null}
    </Callout>
  );
}

export function TournamentStaffAddButton({ tournamentId }: { tournamentId: string }) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <PageTopBarPrimaryButton onClick={() => setAddOpen(true)}>
        <PlusIcon />
        {m.tournaments_staff_add()}
      </PageTopBarPrimaryButton>
      <AddStaffDialog tournamentId={tournamentId} open={addOpen} onOpenChange={setAddOpen} />
    </>
  );
}

function AddStaffDialog({
  tournamentId,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addStaff = useAddTournamentStaff();
  // Fetch only while open so the page never suspends on the candidate list.
  const { data: candidates, isLoading } = useTournamentStaffCandidates(tournamentId, open);
  const [role, setRole] = useState<TournamentStaffRole>("judge");
  const [userId, setUserId] = useState("");

  const items = (candidates?.items ?? []).map((candidate) => ({
    value: candidate.userId,
    label: `${candidate.name ?? m.tournaments_staff_candidate_unnamed()}${
      candidate.source === "participant" ? m.tournaments_staff_candidate_participant_suffix() : ""
    }`,
  }));

  async function handleAdd() {
    if (!userId) {
      return;
    }
    try {
      await addStaff.mutateAsync({ id: tournamentId, userId, role });
      onOpenChange(false);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setUserId("");
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogForm onSubmit={() => void handleAdd()}>
          <DialogHeader>
            <DialogTitle>{m.tournaments_staff_add()}</DialogTitle>
            <DialogDescription>{m.tournaments_staff_add_description()}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_staff_role_label()}</Label>
              <Select
                items={roleItems()}
                value={role}
                onValueChange={(value) => value && setRole(value as TournamentStaffRole)}
              >
                <SelectTrigger aria-label={m.tournaments_staff_role_label()}>
                  <SelectValue placeholder={m.tournaments_staff_role_placeholder()} />
                </SelectTrigger>
                <SelectContent>
                  {roleItems().map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-sm">{m.tournaments_staff_role_hint()}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{m.tournaments_staff_person_label()}</Label>
              {isLoading ? (
                <p className="text-muted-foreground text-sm">{m.tournaments_staff_loading()}</p>
              ) : items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  {m.tournaments_staff_no_candidates()}
                </p>
              ) : (
                <Select
                  items={items}
                  value={userId}
                  onValueChange={(value) => value && setUserId(value)}
                >
                  <SelectTrigger aria-label={m.tournaments_staff_person_label()}>
                    <SelectValue placeholder={m.tournaments_staff_person_placeholder()} />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={!userId || addStaff.isPending}>
              {m.tournaments_roster_add()}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
