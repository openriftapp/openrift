import type { OrganizationRole } from "@openrift/shared/types/api/tournament";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OrgDeckCheckKeysSection } from "@/features/tournaments/components/deck-check-keys-section";
import {
  useAddOrganizationMember,
  useOrganization,
  useRemoveOrganizationMember,
  useUpdateOrganizationMemberRole,
} from "@/features/tournaments/hooks/use-organizations";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function roleLabel(role: OrganizationRole): string {
  return {
    owner: m.tournaments_org_role_owner(),
    manager: m.tournaments_org_role_manager(),
    judge: m.tournaments_org_role_judge(),
  }[role];
}

// The server enforces the last-owner guard, not this list.
function memberRoleItems() {
  return [
    { value: "owner", label: m.tournaments_org_role_owner() },
    { value: "manager", label: m.tournaments_org_role_manager() },
    { value: "judge", label: m.tournaments_org_role_judge() },
  ] satisfies { value: OrganizationRole; label: string }[];
}

export function OrganizationPage({ id }: { id: string }) {
  const { data } = useOrganization(id);
  const addMember = useAddOrganizationMember();
  const removeMember = useRemoveOrganizationMember();
  const updateMemberRole = useUpdateOrganizationMemberRole();

  const isOwner = data.viewerRole === "owner";
  const canManage = data.viewerRole === "owner" || data.viewerRole === "manager";

  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("manager");
  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(
    null,
  );

  // Owners may grant any role; managers can't hand out (or revoke) ownership.
  const allRoleItems = memberRoleItems();
  const roleItems = isOwner ? allRoleItems : allRoleItems.filter((item) => item.value !== "owner");

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
    } catch {
      // Reported by the global mutation onError toast; swallowed so
      // `void run(...)` call sites don't surface an uncaught promise.
    }
  }

  async function handleAddMember() {
    await run(() => addMember.mutateAsync({ id, email: email.trim(), role }));
    setAddOpen(false);
    setEmail("");
  }

  async function handleRemoveMember() {
    if (!memberToRemove) {
      return;
    }
    await run(() => removeMember.mutateAsync({ id, userId: memberToRemove.userId }));
    setMemberToRemove(null);
  }

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{data.name}</PageTopBarTitle>
          <Badge variant="outline" className="shrink-0 font-mono">
            {data.slug}
          </Badge>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6 pt-3", PAGE_PADDING_NO_TOP)}>
        {data.description ? <PageDescription>{data.description}</PageDescription> : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <SectionHeading count={data.members.length}>
              {m.tournaments_org_members_heading()}
            </SectionHeading>
            {canManage ? (
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                {m.tournaments_org_add_member()}
              </Button>
            ) : null}
          </div>
          <CardList>
            {data.members.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{member.name ?? member.userId}</span>
                  {isOwner ? (
                    <Select
                      items={allRoleItems}
                      value={member.role}
                      disabled={updateMemberRole.isPending}
                      onValueChange={(value) => {
                        if (
                          (value === "owner" || value === "manager" || value === "judge") &&
                          value !== member.role
                        ) {
                          void run(() =>
                            updateMemberRole.mutateAsync({
                              id,
                              userId: member.userId,
                              role: value,
                            }),
                          );
                        }
                      }}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={m.tournaments_org_role_for({
                          name: member.name ?? member.userId,
                        })}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allRoleItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline">{roleLabel(member.role)}</Badge>
                  )}
                </span>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={removeMember.isPending}
                    onClick={() =>
                      setMemberToRemove({
                        userId: member.userId,
                        name: member.name ?? member.userId,
                      })
                    }
                  >
                    {m.tournaments_org_remove()}
                  </Button>
                ) : null}
              </li>
            ))}
          </CardList>
        </section>

        {canManage ? (
          <section className="flex flex-col gap-3">
            <SectionHeading>{m.tournaments_org_integrations_heading()}</SectionHeading>
            <OrgDeckCheckKeysSection orgId={id} enabled={canManage} />
          </section>
        ) : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogForm onSubmit={() => void handleAddMember()}>
            <DialogHeader>
              <DialogTitle>{m.tournaments_org_add_member()}</DialogTitle>
              <DialogDescription>{m.tournaments_org_add_member_description()}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="org-member">{m.tournaments_org_email_label()}</Label>
                <Input
                  id="org-member"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="member@example.com"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{m.tournaments_org_role_label()}</Label>
                <Select
                  items={roleItems}
                  value={role}
                  onValueChange={(value) => value && setRole(value as OrganizationRole)}
                >
                  <SelectTrigger aria-label={m.tournaments_org_role_label()}>
                    <SelectValue placeholder={m.tournaments_org_choose_role()} />
                  </SelectTrigger>
                  <SelectContent>
                    {roleItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                {m.common_cancel()}
              </Button>
              <Button type="submit" disabled={!email.trim() || addMember.isPending}>
                {m.tournaments_org_add()}
              </Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToRemove(null);
          }
        }}
        title={m.tournaments_org_remove_member_title()}
        description={
          memberToRemove
            ? m.tournaments_org_remove_member_description({ name: memberToRemove.name })
            : ""
        }
        confirmLabel={m.tournaments_org_remove()}
        pendingLabel={m.tournaments_org_removing()}
        isPending={removeMember.isPending}
        onConfirm={() => void handleRemoveMember()}
      />
    </>
  );
}
