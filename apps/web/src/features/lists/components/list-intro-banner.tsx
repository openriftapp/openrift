import type { ListIntent, ListKind } from "@openrift/shared/types/api/list";
import { Link } from "@tanstack/react-router";
import {
  CheckSquareIcon,
  FolderInputIcon,
  LibraryBigIcon,
  Share2Icon,
  SparklesIcon,
  TagIcon,
} from "lucide-react";

import type { IntroGuideRow } from "@/components/intro-banner";
import { IntroBanner, IntroGuideList } from "@/components/intro-banner";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

function fromLibraryRow(): IntroGuideRow {
  return {
    icons: [LibraryBigIcon],
    title: m.lists_intro_from_library_title(),
    description: m.lists_intro_from_library_description(),
  };
}

function fromCollectionRow(): IntroGuideRow {
  return {
    icons: [CheckSquareIcon],
    title: m.lists_intro_from_collection_title(),
    description: m.lists_intro_from_collection_description(),
  };
}

function dynamicRulesRow(): IntroGuideRow {
  return {
    icons: [SparklesIcon],
    title: m.lists_intro_rules_title(),
    description: m.lists_intro_rules_description(),
  };
}

function tradePreferencesRow(): IntroGuideRow {
  return {
    icons: [TagIcon],
    title: m.lists_intro_prefs_title(),
    description: m.lists_intro_prefs_description(),
  };
}

function shareRow(): IntroGuideRow {
  return {
    icons: [Share2Icon],
    title: m.lists_intro_share_title(),
    description: m.lists_intro_share_description(),
  };
}

function fileAwayRow(): IntroGuideRow {
  return {
    icons: [FolderInputIcon],
    title: m.lists_intro_file_away_title(),
    description: m.lists_intro_file_away_description(),
  };
}

function introCopy(
  intent: ListIntent,
  kind: ListKind,
): { title: string; lead: string; rows: readonly IntroGuideRow[] } {
  if (intent === "wish") {
    return {
      title: m.lists_intro_wish_title(),
      lead: m.lists_intro_wish_lead(),
      rows: [fromLibraryRow(), dynamicRulesRow(), tradePreferencesRow(), shareRow()],
    };
  }
  if (intent === "trade") {
    return {
      title: m.lists_intro_trade_title(),
      lead: m.lists_intro_trade_lead(),
      rows: [fromCollectionRow(), dynamicRulesRow(), tradePreferencesRow(), shareRow()],
    };
  }
  return {
    title: m.lists_intro_organize_title(),
    lead: m.lists_intro_organize_lead(),
    rows:
      kind === "copy"
        ? [fromCollectionRow(), dynamicRulesRow(), fileAwayRow(), shareRow()]
        : [fromLibraryRow(), dynamicRulesRow(), shareRow()],
  };
}

export function ListIntroBanner({
  intent,
  kind,
  onDismiss,
}: {
  intent: ListIntent;
  kind: ListKind;
  onDismiss: () => void;
}) {
  const copy = introCopy(intent, kind);
  return (
    <IntroBanner className="mb-3" title={copy.title} lead={copy.lead} onDismiss={onDismiss}>
      <IntroGuideList rows={copy.rows} />
      <TextLink render={<Link to="/help/$slug" params={{ slug: "lists" }} />}>
        {m.lists_intro_help_link()}
      </TextLink>
    </IntroBanner>
  );
}
