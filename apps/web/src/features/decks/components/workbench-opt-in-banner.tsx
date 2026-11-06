import { useNavigate } from "@tanstack/react-router";
import { FlaskConicalIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
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
    <Callout className="mb-3 flex items-center gap-3">
      <FlaskConicalIcon className="text-primary size-4 shrink-0" />
      <span className="min-w-0 flex-1">{m.decks_workbench_banner_text()}</span>
      <Button
        size="sm"
        disabled={setOwnFlag.isPending}
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
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={m.decks_workbench_banner_dismiss()}
        onClick={() => dismissIntro("deck-builder-beta")}
      >
        <XIcon className="size-4" />
      </Button>
    </Callout>
  );
}
