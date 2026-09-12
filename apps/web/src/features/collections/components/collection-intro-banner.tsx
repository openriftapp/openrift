import { Link } from "@tanstack/react-router";
import {
  CheckSquareIcon,
  CopyIcon,
  LayoutGridIcon,
  LibraryBigIcon,
  Rows3Icon,
  SlidersHorizontalIcon,
  SquareIcon,
  SquareStackIcon,
} from "lucide-react";

import type { IntroGuideRow } from "@/components/intro-banner";
import { IntroBanner, IntroGuideList } from "@/components/intro-banner";
import { Kbd } from "@/components/ui/kbd";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function guideRows(): readonly IntroGuideRow[] {
  return [
    {
      icons: [LibraryBigIcon],
      title: m.collections_intro_library_title(),
      description: m.collections_intro_library_description(),
    },
    {
      icons: [SquareIcon, CopyIcon, SquareStackIcon],
      title: m.collections_intro_units_title(),
      description: m.collections_intro_units_description(),
      desktopOnly: true,
    },
    {
      icons: [CheckSquareIcon],
      title: m.collections_intro_manage_title(),
      description: m.collections_intro_manage_description(),
    },
    {
      icons: [LayoutGridIcon, Rows3Icon],
      title: m.collections_intro_view_title(),
      description: m.collections_intro_view_description(),
      desktopOnly: true,
    },
    {
      icons: [SlidersHorizontalIcon],
      title: m.collections_intro_options_title(),
      description: m.collections_intro_options_description(),
      mobileOnly: true,
    },
  ];
}

export function CollectionIntroBanner({
  showLibrary,
  onDismiss,
}: {
  showLibrary: boolean;
  onDismiss: () => void;
}) {
  return (
    <IntroBanner
      className="mb-3"
      title={m.collections_intro_title()}
      lead={showLibrary ? m.collections_intro_lead_library() : m.collections_intro_lead_owned()}
      onDismiss={onDismiss}
    >
      <IntroGuideList rows={guideRows()} />
      <p className="text-muted-foreground">
        <span className="hidden sm:inline">
          <Kbd>Ctrl</Kbd>+<Kbd>K</Kbd> {m.collections_intro_quick_add()} ·{" "}
        </span>
        <TextLink render={<Link to="/collections/import" />}>
          {m.collections_intro_import_link()}
        </TextLink>{" "}
        ·{" "}
        <TextLink render={<Link to="/help/$slug" params={{ slug: "cards-printings-copies" }} />}>
          {m.collections_intro_help_link()}
        </TextLink>
      </p>
    </IntroBanner>
  );
}
