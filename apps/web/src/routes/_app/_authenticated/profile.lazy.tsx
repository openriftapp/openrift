import { formatDay } from "@openrift/shared/format-date";
import { createLazyFileRoute } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import type { PageTocItem } from "@/components/layout/page-toc";
import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { UserAvatar } from "@/components/user-avatar";
import { AccountInfoSection } from "@/features/account/components/account-info-section";
import { AdminNotificationsSection } from "@/features/account/components/admin-notifications-section";
import { ConnectedAccountsSection } from "@/features/account/components/connected-accounts-section";
import { ContactMethodsSection } from "@/features/account/components/contact-methods-section";
import { DangerZoneSection } from "@/features/account/components/danger-zone-section";
import { DisplaySection } from "@/features/account/components/display-section";
import { GroupNotificationsSection } from "@/features/account/components/group-notifications-section";
import { LanguagesSection } from "@/features/account/components/languages-section";
import { MarketplacesSection } from "@/features/account/components/marketplaces-section";
import { MetaCreditSection } from "@/features/account/components/meta-credit-section";
import { PasswordSection } from "@/features/account/components/password-section";
import { PublicProfileSection } from "@/features/account/components/public-profile-section";
import { PublicSharingSection } from "@/features/account/components/public-sharing-section";
import { TradingSection } from "@/features/account/components/trading-section";
import { useIsAdmin } from "@/features/admin/hooks/use-admin";
import { MyDeckCheckKeysSection } from "@/features/tournaments/components/deck-check-keys-section";
import { useLanguageList } from "@/hooks/use-enums";
import { useSession } from "@/lib/auth-session";
import { useGravatarHash } from "@/lib/gravatar";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/_authenticated/profile")({
  component: ProfilePage,
});

function navSections(isAdmin: boolean): PageTocItem[] {
  return [
    { id: "sharing", label: m.profile_nav_sharing() },
    { id: "preferences", label: m.profile_nav_preferences() },
    { id: "display", label: m.profile_nav_display(), level: 1 },
    { id: "marketplaces", label: m.profile_nav_marketplaces(), level: 1 },
    { id: "languages", label: m.profile_nav_languages(), level: 1 },
    { id: "trading", label: m.profile_nav_trading(), level: 1 },
    { id: "contacts", label: m.profile_nav_contacts(), level: 1 },
    { id: "groups", label: m.profile_nav_groups(), level: 1 },
    { id: "integrations", label: m.profile_nav_integrations() },
    ...(isAdmin ? [{ id: "admin", label: m.profile_nav_admin() }] : []),
    { id: "account", label: m.profile_nav_account() },
    { id: "security", label: m.profile_nav_security() },
    { id: "danger-zone", label: m.profile_nav_danger_zone() },
  ];
}

function ProfilePage() {
  const { data: session } = useSession();
  const languages = useLanguageList();
  const user = session?.user;
  const gravatarHash = useGravatarHash(user?.email);
  const { data: isAdmin = false } = useIsAdmin();

  if (!user) {
    return null;
  }

  const createdAt = user.createdAt ? formatDay(user.createdAt) : null;

  return (
    <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING, "flex flex-col gap-8")}>
      <div className="flex items-center gap-4">
        <UserAvatar
          image={user.image}
          name={user.name}
          email={user.email}
          gravatarHash={gravatarHash}
          size="lg"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Heading level={1}>{user.name || user.email}</Heading>
          <p className="text-muted-foreground">{user.email}</p>
          {createdAt && (
            <p className="text-muted-foreground text-sm">{m.profile_joined({ date: createdAt })}</p>
          )}
        </div>
      </div>

      <SettingsLayout toc={navSections(isAdmin)}>
        <SettingsGroup id="sharing" title={m.profile_nav_sharing()}>
          <PublicSharingSection />
          <PublicProfileSection
            userId={user.id}
            values={{
              bio: user.bio ?? null,
              profileShowRiotId: user.profileShowRiotId ?? false,
              profileShowCollection: user.profileShowCollection ?? false,
              profileShowLastActive: user.profileShowLastActive ?? true,
            }}
          />
          {/* Renders nothing while the meta archive is unlaunched. */}
          <MetaCreditSection />
        </SettingsGroup>

        <SettingsGroup id="preferences" title={m.profile_nav_preferences()}>
          <DisplaySection />
          <MarketplacesSection />
          <LanguagesSection availableLanguages={languages} />
          <TradingSection />
          <ContactMethodsSection />
          <GroupNotificationsSection />
        </SettingsGroup>

        <SettingsGroup id="integrations" title={m.profile_nav_integrations()}>
          <MyDeckCheckKeysSection />
        </SettingsGroup>

        {isAdmin && (
          <SettingsGroup id="admin" title={m.profile_nav_admin()}>
            <AdminNotificationsSection />
          </SettingsGroup>
        )}

        <SettingsGroup id="account" title={m.profile_nav_account()}>
          <AccountInfoSection
            defaultName={user.name ?? ""}
            defaultRiotId={user.riotId ?? ""}
            userId={user.id}
            currentEmail={user.email}
          />
          <ConnectedAccountsSection />
        </SettingsGroup>

        <SettingsGroup id="security" title={m.profile_nav_security()}>
          <PasswordSection currentEmail={user.email} />
        </SettingsGroup>

        <SettingsGroup id="danger-zone" title={m.profile_nav_danger_zone()}>
          <DangerZoneSection />
        </SettingsGroup>
      </SettingsLayout>
    </div>
  );
}
