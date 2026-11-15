import type { CreateCardBody } from "@openrift/shared/contracts/admin/card-mutations";
import { slugifyName } from "@openrift/shared/strings";
import { useState } from "react";

import { parseIntegerFields } from "@/lib/integer-input";

type ManualCardStat = "might" | "energy" | "power" | "mightBonus";

export const MANUAL_CARD_STATS: { key: ManualCardStat; label: string }[] = [
  { key: "might", label: "Might" },
  { key: "energy", label: "Energy" },
  { key: "power", label: "Power" },
  { key: "mightBonus", label: "Might bonus" },
];

export function useManualCardDraft() {
  const [name, setName] = useState("");
  const [slugEdit, setSlugEdit] = useState<string | null>(null);
  // Selection order matters: the first type is primary.
  const [types, setTypes] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [superTypes, setSuperTypes] = useState<string[]>([]);
  const [numeric, setNumeric] = useState<Record<ManualCardStat, string>>({
    might: "",
    energy: "",
    power: "",
    mightBonus: "",
  });
  const [tags, setTags] = useState<string[]>([]);

  const slugInput = slugEdit ?? slugifyName(name);
  const slug = slugInput.trim();
  const trimmedName = name.trim();
  const stats = parseIntegerFields(numeric);
  const input: CreateCardBody | undefined =
    stats !== undefined &&
    trimmedName.length > 0 &&
    slug.length > 0 &&
    types.length > 0 &&
    domains.length > 0
      ? {
          id: slug,
          name: trimmedName,
          types,
          domains,
          ...(superTypes.length > 0 && { superTypes }),
          ...stats,
          ...(tags.length > 0 && { tags }),
        }
      : undefined;

  return {
    name,
    setName,
    slugInput,
    setSlug: setSlugEdit,
    slug,
    types,
    setTypes,
    domains,
    setDomains,
    superTypes,
    setSuperTypes,
    numeric,
    setStat: (key: ManualCardStat, value: string) =>
      setNumeric((prev) => ({ ...prev, [key]: value })),
    tags,
    setTags,
    input,
  };
}
