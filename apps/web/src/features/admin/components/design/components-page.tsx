import type { DesignSection } from "@/features/admin/components/design/design-sections";
import { DesignTierPage } from "@/features/admin/components/design/design-tier-page";

import { ACTIONS_GROUPS, ActionsSection } from "./ui/actions-section";
import { CHOICE_GROUPS, ChoiceSection } from "./ui/choice-section";
import { COMPOSED_GROUPS, ComposedSection } from "./ui/composed-section";
import { COUNTS_GROUPS, CountsSection } from "./ui/counts-section";
import { DATA_GROUPS, DataSection } from "./ui/data-section";
import { FEEDBACK_GROUPS, FeedbackSection } from "./ui/feedback-section";
import { FIELDS_GROUPS, FieldsSection } from "./ui/fields-section";
import { LOADING_GROUPS, LoadingSection } from "./ui/loading-section";
import { MARKS_GROUPS, MarksSection } from "./ui/marks-section";
import { MEDIA_GROUPS, MediaSection } from "./ui/media-section";
import { OVERLAYS_GROUPS, OverlaysSection } from "./ui/overlays-section";
import { PARTS_GROUPS, PartsSection } from "./ui/parts-section";
import { PEOPLE_GROUPS, PeopleSection } from "./ui/people-section";
import { PICKERS_GROUPS, PickersSection } from "./ui/pickers-section";
import { SURFACES_GROUPS, SurfacesSection } from "./ui/surfaces-section";

const SECTIONS: readonly DesignSection[] = [
  { id: "actions", title: "Actions", Component: ActionsSection, groups: ACTIONS_GROUPS },
  { id: "fields", title: "Fields", Component: FieldsSection, groups: FIELDS_GROUPS },
  { id: "choice", title: "Choice", Component: ChoiceSection, groups: CHOICE_GROUPS },
  { id: "pickers", title: "Pickers", Component: PickersSection, groups: PICKERS_GROUPS },
  { id: "overlays", title: "Overlays", Component: OverlaysSection, groups: OVERLAYS_GROUPS },
  { id: "composed", title: "Composed blocks", Component: ComposedSection, groups: COMPOSED_GROUPS },
  { id: "feedback", title: "Feedback", Component: FeedbackSection, groups: FEEDBACK_GROUPS },
  { id: "loading", title: "Loading & paging", Component: LoadingSection, groups: LOADING_GROUPS },
  { id: "marks", title: "Marks & chips", Component: MarksSection, groups: MARKS_GROUPS },
  {
    id: "counts",
    title: "Counts, figures & filter chips",
    Component: CountsSection,
    groups: COUNTS_GROUPS,
  },
  {
    id: "surfaces",
    title: "Surfaces & lists",
    Component: SurfacesSection,
    groups: SURFACES_GROUPS,
  },
  { id: "data", title: "Data & layout", Component: DataSection, groups: DATA_GROUPS },
  { id: "parts", title: "Parts", Component: PartsSection, groups: PARTS_GROUPS },
  { id: "media", title: "Images, codes & copy", Component: MediaSection, groups: MEDIA_GROUPS },
  { id: "people", title: "People & standings", Component: PeopleSection, groups: PEOPLE_GROUPS },
];

export function DesignComponentsPage() {
  return (
    <DesignTierPage
      description="Every primitive with one home each. Turn on Specs to read measured sizes and colors."
      sections={SECTIONS}
    />
  );
}
