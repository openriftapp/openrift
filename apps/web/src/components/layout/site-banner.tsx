import { LocaleBanner } from "@/features/account/components/locale-banner";
import { useLocaleBanner } from "@/features/account/hooks/use-locale-banner";
import { InstallNudge } from "@/features/marketing/components/install-nudge";
import { MilestoneBanner } from "@/features/marketing/components/milestone-banner";
import { useInstallNudge } from "@/features/marketing/hooks/use-install-nudge";
import { useMilestoneBanner } from "@/features/marketing/hooks/use-milestone-banner";
import { pickSiteBanner } from "@/lib/site-banner";

export function SiteBanner() {
  const locale = useLocaleBanner();
  const milestone = useMilestoneBanner();
  const install = useInstallNudge();
  const picked = pickSiteBanner({
    locale: locale.kind !== "hide",
    milestone: milestone !== null,
    install,
  });

  if (picked === "locale" && locale.kind !== "hide") {
    return <LocaleBanner decision={locale} />;
  }
  if (picked === "milestone" && milestone !== null) {
    return <MilestoneBanner milestone={milestone} />;
  }
  if (picked === "install") {
    return <InstallNudge />;
  }
  return null;
}
