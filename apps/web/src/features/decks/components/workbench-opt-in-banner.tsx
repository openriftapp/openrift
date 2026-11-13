import { useNavigate } from "@tanstack/react-router";
import { FlaskConicalIcon } from "lucide-react";

import { NudgeCallout } from "@/components/nudge-callout";
import { Button } from "@/components/ui/button";
import { useSetOwnFeatureFlag } from "@/hooks/use-own-feature-flag";
import { useSession } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";
import { useOnboardingStore } from "@/stores/onboarding-store";

export function WorkbenchOptInBanner() {
  const { data: session } = useSession();
  const dismissed = useOnboardingStore((state) =>
    state.dismissedIntros.includes("deck-builder-beta"),
  );
  const dismissIntro = useOnboardingStore((state) => state.dismissIntro);
  const setOwnFlag = useSetOwnFeatureFlag();
  const navigate = useNavigate();

  if (!session?.user || dismissed) {
    return null;
  }

  return (
    <NudgeCallout
      className="mb-3"
      icon={FlaskConicalIcon}
      title={m.decks_workbench_banner_text()}
      dismissLabel={m.decks_workbench_banner_dismiss()}
      onDismiss={() => dismissIntro("deck-builder-beta")}
      action={
        <Button
          size="sm"
          pending={setOwnFlag.isPending}
          onClick={() =>
            setOwnFlag.mutate(
              { key: "deck-builder-beta", enabled: true },
              // The classic editor writes zone presets into the URL; the beta layers its own.
              { onSuccess: () => void navigate({ to: ".", search: {}, replace: true }) },
            )
          }
        >
          {m.decks_workbench_banner_try()}
        </Button>
      }
    />
  );
}
