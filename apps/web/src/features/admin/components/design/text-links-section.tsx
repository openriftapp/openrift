import { TextLink } from "@/components/ui/text-link";

import { DemoRow, DemoSection } from "./demo-primitives";

export function TextLinksSection() {
  return (
    <DemoSection
      id="text-links"
      title="Text links"
      note="Links inside running text. A link that needs a box is a Button with variant=link, not a TextLink."
    >
      <DemoRow label="Variants" className="block space-y-2">
        <p>
          Read the <TextLink href="#text-links">tournament rules</TextLink> before the Summoner
          Skirmish.
        </p>
        <p className="text-muted-foreground text-sm">
          Hosting costs are covered by{" "}
          <TextLink variant="muted" href="#text-links">
            supporters
          </TextLink>
          .
        </p>
        <p className="font-medium">
          <TextLink variant="inherit" href="#text-links">
            Jinx, Loose Cannon
          </TextLink>
        </p>
      </DemoRow>
    </DemoSection>
  );
}
