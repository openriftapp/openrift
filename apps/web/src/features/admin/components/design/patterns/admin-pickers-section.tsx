import type { ReleasePrecision } from "@openrift/shared/set-release";
import { Suspense, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { DatePrecisionControl } from "@/features/admin/components/date-precision-control";
import {
  DemoGroup,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { LanguageSelect } from "@/features/admin/components/language-select";
import { SetPicker } from "@/features/admin/components/set-picker";

const GROUPS = {
  catalog: { id: "admin-pickers-catalog", title: "Catalog pickers" },
  precision: { id: "admin-pickers-precision", title: "DatePrecisionControl" },
} as const;

export const ADMIN_PICKERS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_LANGUAGES = [
  { code: "EN", name: "English" },
  { code: "FR", name: "French" },
  { code: "DE", name: "German" },
  { code: "ZH", name: "Chinese (Simplified)" },
];

export function AdminPickersSection() {
  const [language, setLanguage] = useState("EN");
  const [newLanguage, setNewLanguage] = useState("");
  const [setId, setSetId] = useState("");
  const [optionalSetId, setOptionalSetId] = useState("");
  const [precision, setPrecision] = useState<ReleasePrecision>("day");
  const [setPrecisionValue, setSetPrecisionValue] = useState<ReleasePrecision>("quarter");

  return (
    <DemoSection
      id="admin-pickers"
      title="Admin pickers"
      note="Admin wrappers over the picker bases that bring their own options."
    >
      <DemoGroup
        {...GROUPS.catalog}
        hint="LanguageSelect is a SimpleSelect over the catalog languages. SetPicker is a ComboboxPicker over the live sets, searchable by set code."
      >
        <SwatchRow label="LanguageSelect">
          <Swatch label="value">
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              languages={DEMO_LANGUAGES}
              label="Language"
              className="w-44"
            />
          </Swatch>
          <Swatch label="placeholder, exclude">
            <LanguageSelect
              value={newLanguage}
              onChange={setNewLanguage}
              languages={DEMO_LANGUAGES}
              exclude={[language]}
              placeholder="Add a language"
              label="New language"
              className="w-44"
            />
          </Swatch>
          <Swatch label="sm">
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              languages={DEMO_LANGUAGES}
              label="Language, small"
              size="sm"
              className="w-36"
            />
          </Swatch>
        </SwatchRow>
        <SwatchRow label="SetPicker">
          <Suspense fallback={<Skeleton className="h-(--control-h) w-48" />}>
            <Swatch label="required">
              <SetPicker value={setId} onChange={setSetId} className="w-48" />
            </Swatch>
            <Swatch label="noneLabel">
              <SetPicker
                value={optionalSetId}
                onChange={setOptionalSetId}
                noneLabel="No set"
                label="Optional set"
                className="w-48"
              />
            </Swatch>
          </Suspense>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.precision}
        hint="How exact a release date is. Only the sets page offers the quarter step."
      >
        <SwatchRow label="Variants">
          <Swatch label="default">
            <DatePrecisionControl value={precision} onChange={setPrecision} />
          </Swatch>
          <Swatch label="includeQuarter">
            <DatePrecisionControl
              value={setPrecisionValue}
              onChange={setSetPrecisionValue}
              includeQuarter
            />
          </Swatch>
        </SwatchRow>
      </DemoGroup>
    </DemoSection>
  );
}
