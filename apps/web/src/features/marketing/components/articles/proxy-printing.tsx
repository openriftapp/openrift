import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { ImageIcon, InfoIcon, RulerIcon, ScissorsIcon, ShieldCheckIcon } from "lucide-react";

import { Eyebrow, Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Callout } from "@/components/ui/callout";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { m } from "@/paraglide/messages.js";

export default function ProxyPrintingArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_proxy_printing_intro()}</p>

      <Callout>
        <Eyebrow>{m.help_proxy_printing_layout_eyebrow()}</Eyebrow>
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }, (_, index) => (
            <div
              key={index}
              className="bg-background aspect-card flex items-center justify-center rounded-md"
            >
              <span className="text-muted-foreground/40 text-2xs tabular-nums">{index + 1}</span>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground mt-4">{m.help_proxy_printing_layout_caption()}</p>
      </Callout>

      <section>
        <Heading className="mb-2">{m.help_proxy_printing_start_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_proxy_printing_start_intro()}</p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_proxy_printing_step_editor_title()}
            description={m.help_proxy_printing_step_editor_description()}
          />
          <StepRow
            step={2}
            title={m.help_proxy_printing_step_list_title()}
            description={m.help_proxy_printing_step_list_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_proxy_printing_options_heading()}</Heading>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<ImageIcon className="size-4" />}
            title={m.help_proxy_printing_option_render_title()}
            description={m.help_proxy_printing_option_render_description()}
          />
          <FeatureCard
            icon={<RulerIcon className="size-4" />}
            title={m.help_proxy_printing_option_page_title()}
            description={m.help_proxy_printing_option_page_description()}
          />
          <FeatureCard
            icon={<ScissorsIcon className="size-4" />}
            title={m.help_proxy_printing_option_cut_title()}
            description={m.help_proxy_printing_option_cut_description()}
          />
          <FeatureCard
            icon={<ShieldCheckIcon className="size-4" />}
            title={m.help_proxy_printing_option_watermark_title()}
            description={m.help_proxy_printing_option_watermark_description()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_proxy_printing_generate_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_proxy_printing_generate}
            markup={{
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">{m.help_proxy_printing_generate_copies()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_proxy_printing_limits_heading()}</Heading>
        <Alert>
          <InfoIcon className="text-primary" />
          <AlertDescription>{m.help_proxy_printing_limits_body()}</AlertDescription>
        </Alert>
      </section>

      <section>
        <Heading className="mb-2">{m.help_proxy_printing_printing_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_proxy_printing_printing_body()}</p>
      </section>
    </div>
  );
}
