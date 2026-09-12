import { Link } from "@tanstack/react-router";
import { EyeOffIcon } from "lucide-react";
import { Fragment } from "react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DefinitionDetail, DefinitionList, DefinitionTerm } from "@/components/ui/definition-list";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { TextLink } from "@/components/ui/text-link";
import { StepRow } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

function keyRows(): { id: string; keys: string[]; does: string }[] {
  return [
    { id: "next", keys: ["→", "↓", "Space"], does: m.help_stage_key_next_card() },
    { id: "previous", keys: ["←", "↑"], does: m.help_stage_key_previous_card() },
    { id: "first-last", keys: ["Home", "End"], does: m.help_stage_key_first_last() },
    { id: "text", keys: ["T"], does: m.help_stage_key_toggle_text() },
    { id: "strip", keys: ["F"], does: m.help_stage_key_toggle_strip() },
    { id: "push", keys: ["P"], does: m.help_stage_key_push_overlay() },
    { id: "board", keys: ["O"], does: m.help_stage_key_show_board() },
    { id: "keys", keys: ["?"], does: m.help_stage_key_show_keys() },
    { id: "leave", keys: ["Esc"], does: m.help_stage_key_leave() },
  ];
}

function obsSteps(): { title: string; description: string }[] {
  return [
    {
      title: m.help_stage_obs_step_1_title(),
      description: m.help_stage_obs_step_1_description(),
    },
    {
      title: m.help_stage_obs_step_2_title(),
      description: m.help_stage_obs_step_2_description(),
    },
    {
      title: m.help_stage_obs_step_3_title(),
      description: m.help_stage_obs_step_3_description(),
    },
    {
      title: m.help_stage_obs_step_4_title(),
      description: m.help_stage_obs_step_4_description(),
    },
  ];
}

export default function StageArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_stage_intro()}</p>
      <p>
        <TextLink className="font-medium" render={<Link to="/stage" />}>
          {m.help_stage_open_link()}
        </TextLink>
      </p>

      <section>
        <Heading className="mb-2">{m.help_stage_show_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_stage_show_intro()}</p>
        <DefinitionList className="text-muted-foreground mt-3">
          {keyRows().map((row) => (
            <Fragment key={row.id}>
              <DefinitionTerm className="self-center">
                <KbdGroup>
                  {row.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </KbdGroup>
              </DefinitionTerm>
              <DefinitionDetail className="self-center">{row.does}</DefinitionDetail>
            </Fragment>
          ))}
        </DefinitionList>
      </section>

      <section>
        <Heading className="mb-2">{m.help_stage_obs_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_stage_obs_intro()}</p>
        <div className="mt-3 space-y-2">
          {obsSteps().map((step, index) => (
            <StepRow
              key={step.title}
              step={index + 1}
              title={step.title}
              description={step.description}
            />
          ))}
        </div>
      </section>

      <Alert>
        <EyeOffIcon className="size-4" />
        <AlertDescription>{m.help_stage_alert_private_link()}</AlertDescription>
      </Alert>
    </div>
  );
}
