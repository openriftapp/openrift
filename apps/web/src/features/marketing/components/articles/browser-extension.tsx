import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { InfoIcon, LinkIcon, ListIcon, ScanTextIcon, TableIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TextLink } from "@/components/ui/text-link";
import { FeatureCard, StepRow } from "@/features/marketing/components/article-cards";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

export default function BrowserExtensionArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">{m.help_browser_extension_intro()}</p>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_install_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_browser_extension_install_intro()}</p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_browser_extension_install_step_1_title()}
            description={m.help_browser_extension_install_step_1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_browser_extension_install_step_2_title()}
            description={m.help_browser_extension_install_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_browser_extension_install_step_3_title()}
            description={m.help_browser_extension_install_step_3_desc()}
          />
        </div>
        <p className="mt-3">
          <TextLink
            className="font-medium"
            href={SOCIAL_LINKS.extensionDownload}
            target="_blank"
            rel="noreferrer"
          >
            {m.help_browser_extension_install_download()}
          </TextLink>
        </p>
        <p className="text-muted-foreground mt-3">{m.help_browser_extension_install_updates()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_import_heading()}</Heading>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_browser_extension_import_step_1_title()}
            description={m.help_browser_extension_import_step_1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_browser_extension_import_step_2_title()}
            description={m.help_browser_extension_import_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_browser_extension_import_step_3_title()}
            description={m.help_browser_extension_import_step_3_desc()}
          />
        </div>
        <p className="text-muted-foreground mt-3">{m.help_browser_extension_import_signed_out()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_read_heading()}</Heading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FeatureCard
            icon={<TableIcon className="size-4" />}
            title={m.help_browser_extension_read_tables_title()}
            description={m.help_browser_extension_read_tables_desc()}
          />
          <FeatureCard
            icon={<ListIcon className="size-4" />}
            title={m.help_browser_extension_read_lists_title()}
            description={m.help_browser_extension_read_lists_desc()}
          />
          <FeatureCard
            icon={<ScanTextIcon className="size-4" />}
            title={m.help_browser_extension_read_codes_title()}
            description={m.help_browser_extension_read_codes_desc()}
          />
          <FeatureCard
            icon={<LinkIcon className="size-4" />}
            title={m.help_browser_extension_read_none_title()}
            description={m.help_browser_extension_read_none_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_counts_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_browser_extension_counts_intro()}</p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_browser_extension_counts_step_1_title()}
            description={
              <ParaglideMessage
                message={m.help_browser_extension_counts_step_1}
                markup={{
                  link: ({ children }) => (
                    <TextLink render={<Link to="/extension/cardmarket" />}>{children}</TextLink>
                  ),
                }}
              />
            }
          />
          <StepRow
            step={2}
            title={m.help_browser_extension_counts_step_2_title()}
            description={m.help_browser_extension_counts_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_browser_extension_counts_step_3_title()}
            description={
              <ParaglideMessage
                message={m.help_browser_extension_counts_step_3}
                markup={{ code: ({ children }) => <span className="font-mono">{children}</span> }}
              />
            }
          />
        </div>
        <p className="text-muted-foreground mt-3">{m.help_browser_extension_counts_price()}</p>
        <p className="text-muted-foreground mt-3">{m.help_browser_extension_counts_stale()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_picks_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_browser_extension_picks_intro()}</p>
        <div className="mt-3 space-y-2">
          <StepRow
            step={1}
            title={m.help_browser_extension_picks_step_1_title()}
            description={m.help_browser_extension_picks_step_1_desc()}
          />
          <StepRow
            step={2}
            title={m.help_browser_extension_picks_step_2_title()}
            description={m.help_browser_extension_picks_step_2_desc()}
          />
          <StepRow
            step={3}
            title={m.help_browser_extension_picks_step_3_title()}
            description={m.help_browser_extension_picks_step_3_desc()}
          />
        </div>
      </section>

      <section>
        <Heading className="mb-2">{m.help_browser_extension_access_heading()}</Heading>
        <p className="text-muted-foreground">{m.help_browser_extension_access_p1()}</p>
        <p className="text-muted-foreground mt-3">{m.help_browser_extension_access_p2()}</p>
      </section>

      <section>
        <Alert>
          <InfoIcon className="text-primary" />
          <AlertDescription>{m.help_browser_extension_firefox_only()}</AlertDescription>
        </Alert>
      </section>
    </div>
  );
}
