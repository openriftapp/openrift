import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { PlayIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverlayOutputPanel } from "@/features/stage/components/overlay-output-panel";
import { useUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export function StageOutputBlock({
  onStart,
  canStart,
}: {
  onStart: () => void;
  canStart: boolean;
}) {
  const userId = useUserId();

  return (
    <SettingsSection title={m.stage_output_title()}>
      <Tabs defaultValue="screen">
        <TabsList className="w-full">
          <TabsTrigger value="screen">{m.stage_output_tab_screen()}</TabsTrigger>
          <TabsTrigger value="obs">{m.stage_output_tab_obs()}</TabsTrigger>
        </TabsList>

        <TabsContent value="screen" className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">{m.stage_output_screen_description()}</p>
          <Button onClick={onStart} disabled={!canStart} className="w-full">
            <PlayIcon />
            {m.stage_output_start()}
          </Button>
          <p className="text-muted-foreground text-sm">{m.stage_output_ground_note()}</p>
        </TabsContent>

        <TabsContent value="obs" className="flex flex-col gap-4">
          {userId === null ? (
            <p className="text-muted-foreground text-sm">
              <ParaglideMessage
                message={m.stage_output_obs_signin}
                markup={{
                  link: ({ children }) => (
                    <Link
                      to="/login"
                      search={{ redirect: "/stage", email: undefined }}
                      className="underline underline-offset-2"
                    >
                      {children}
                    </Link>
                  ),
                }}
              />
            </p>
          ) : (
            <OverlayOutputPanel />
          )}
        </TabsContent>
      </Tabs>
    </SettingsSection>
  );
}
