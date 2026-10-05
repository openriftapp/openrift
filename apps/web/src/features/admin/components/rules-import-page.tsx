import { RULE_LANGUAGES } from "@openrift/shared/rules";
import type { RuleKind, RuleLanguage } from "@openrift/shared/types/api/rules";
import { useState } from "react";

import { Heading } from "@/components/heading";
import {
  SectionHeader,
  SectionHeaderDescription,
  SectionHeaderGroup,
  SectionHeaderTitle,
} from "@/components/section-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import {
  useAdminRuleVersions,
  useDeleteRuleVersion,
  useImportRules,
  useUpdateRuleVersion,
} from "@/features/rules/hooks/use-rules";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";

interface AdminRuleVersion {
  kind: RuleKind;
  language: RuleLanguage;
  version: string;
  comments: string | null;
  label: string | null;
  documentVersion: string | null;
}

const KIND_LABELS: Record<RuleKind, string> = {
  core: "Core",
  tournament: "Tournament",
};

const KIND_ITEMS: { value: RuleKind; label: string }[] = [
  { value: "core", label: "Core" },
  { value: "tournament", label: "Tournament" },
];

const LANGUAGE_ITEMS = RULE_LANGUAGES.map((value) => ({
  value,
  label: DISPLAY_LOCALE_LABELS[value],
}));

function isRuleLanguageItem(value: unknown): value is RuleLanguage {
  return LANGUAGE_ITEMS.some((item) => item.value === value);
}

export function RulesImportPage() {
  const { data: versionsData } = useAdminRuleVersions();
  const importMutation = useImportRules();
  const deleteMutation = useDeleteRuleVersion();

  const [kind, setKind] = useState<RuleKind>("core");
  const [language, setLanguage] = useState<RuleLanguage>("en");
  const [version, setVersion] = useState("");
  const [comments, setComments] = useState("");
  const [label, setLabel] = useState("");
  const [documentVersion, setDocumentVersion] = useState("");
  const [content, setContent] = useState("");
  const [result, setResult] = useState<{
    kind: RuleKind;
    language: RuleLanguage;
    version: string;
    rulesCount: number;
    added: number;
    modified: number;
    removed: number;
  } | null>(null);

  async function handleImport() {
    setResult(null);
    const payload = {
      kind,
      language,
      version: version.trim(),
      comments: comments.trim() || null,
      label: label.trim() || null,
      documentVersion: documentVersion.trim() || null,
      content,
    };
    try {
      const response = await importMutation.mutateAsync(payload);
      setResult(response);
      setContent("");
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  async function handleDelete(entry: AdminRuleVersion) {
    try {
      await deleteMutation.mutateAsync({
        kind: entry.kind,
        language: entry.language,
        version: entry.version,
      });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  const canImport = version.trim() && content.trim() && !importMutation.isPending;

  const versionsByKind = new Map<RuleKind, AdminRuleVersion[]>([
    ["core", []],
    ["tournament", []],
  ]);
  for (const entry of versionsData.versions) {
    versionsByKind.get(entry.kind)?.push(entry);
  }

  return (
    <div className="space-y-8 p-4">
      <AdminPageTopBar title="Rules" />
      <SectionHeader>
        <SectionHeaderGroup>
          <SectionHeaderTitle>Import Rules</SectionHeaderTitle>
          <SectionHeaderDescription>
            Paste rules as one per line: <code>{"<rule_number>. <markdown>"}</code>. Use{" "}
            <code># Heading</code> for titles, <code>## Subheading</code> for subtitles, and a
            literal <code>\n</code> inside a line for hard newlines.
          </SectionHeaderDescription>
        </SectionHeaderGroup>
      </SectionHeader>

      <div className="grid max-w-xl gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="kind">Kind</Label>
          <Select
            items={KIND_ITEMS}
            value={kind}
            onValueChange={(value) => {
              if (value === "core" || value === "tournament") {
                setKind(value);
              }
            }}
          >
            <SelectTrigger id="kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="language">Language</Label>
          <Select
            items={LANGUAGE_ITEMS}
            value={language}
            onValueChange={(value) => {
              if (isRuleLanguageItem(value)) {
                setLanguage(value);
              }
            }}
          >
            <SelectTrigger id="language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {language !== "en" && (
            <p className="text-muted-foreground text-sm">
              Translations need the English version of the same date. Leave number, name and
              comments empty to use the English ones.
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label>Version (date)</Label>
          <DatePicker
            value={version || null}
            onValueChange={setVersion}
            onClear={() => setVersion("")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="document-version">Number (optional)</Label>
            <Input
              id="document-version"
              value={documentVersion}
              onChange={(e) => setDocumentVersion(e.target.value)}
              placeholder="1.4"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="label">Name (optional)</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Vendetta"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="comments">Comments (optional, markdown)</Label>
          <Textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Notes about this version, source links, change summary..."
            rows={4}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="content">Rules Content</Label>
          <Textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              "000. # Golden and Silver Rules\n001. ## Golden Rule\n002. Card text supersedes rules text. Whenever a card fundamentally contradicts the rules, the card's indication is what is true."
            }
            rows={16}
            className="font-mono text-sm"
          />
        </div>

        <Button onClick={() => void handleImport()} disabled={!canImport}>
          {importMutation.isPending ? "Importing..." : "Import"}
        </Button>

        {result && (
          <div className="bg-muted rounded-md p-3 text-sm">
            <p className="font-semibold">
              {`Imported ${KIND_LABELS[result.kind]} v${result.version} (${DISPLAY_LOCALE_LABELS[result.language]})`}
            </p>
            <p>
              {result.rulesCount} rules total: {result.added} added, {result.modified} modified,{" "}
              {result.removed} removed
            </p>
          </div>
        )}

        {importMutation.isError && (
          <Alert variant="destructive">
            <AlertDescription>{importMutation.error.message}</AlertDescription>
          </Alert>
        )}
      </div>

      {(["core", "tournament"] as const).map((targetKind) => {
        const entries = versionsByKind.get(targetKind) ?? [];
        if (entries.length === 0) {
          return null;
        }
        return (
          <div key={targetKind}>
            <Heading level={3} className="mb-2">
              Existing {KIND_LABELS[targetKind]} Versions
            </Heading>
            <div className="space-y-2">
              {entries.map((entry) => (
                <VersionRow
                  key={`${entry.kind}-${entry.language}-${entry.version}`}
                  entry={entry}
                  onDelete={() => void handleDelete(entry)}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function draftFrom(entry: AdminRuleVersion) {
  return {
    comments: entry.comments ?? "",
    label: entry.label ?? "",
    documentVersion: entry.documentVersion ?? "",
  };
}

function VersionRow({
  entry,
  onDelete,
  isDeleting,
}: {
  entry: AdminRuleVersion;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const updateMutation = useUpdateRuleVersion();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => draftFrom(entry));
  const name = [entry.documentVersion, entry.label].filter(Boolean).join(" · ");

  function startEdit() {
    setDraft(draftFrom(entry));
    setIsEditing(true);
  }

  async function save() {
    const payload = {
      kind: entry.kind,
      language: entry.language,
      version: entry.version,
      comments: draft.comments.trim() || null,
      label: draft.label.trim() || null,
      documentVersion: draft.documentVersion.trim() || null,
    };
    try {
      await updateMutation.mutateAsync(payload);
      setIsEditing(false);
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  function cancel() {
    setDraft(draftFrom(entry));
    setIsEditing(false);
  }

  return (
    <div className="space-y-2 rounded-md border p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-mono font-semibold">{entry.version}</span>
          <span className="text-muted-foreground ml-2">
            {DISPLAY_LOCALE_LABELS[entry.language]}
          </span>
          {name && <span className="ml-2 font-semibold">{name}</span>}
          {!isEditing && entry.comments && (
            <span className="text-muted-foreground ml-2 line-clamp-1">{entry.comments}</span>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={cancel} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEdit}>
                Edit
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={isDeleting}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>
      {isEditing && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Number"
              value={draft.documentVersion}
              onChange={(e) => setDraft({ ...draft, documentVersion: e.target.value })}
              placeholder="Number, e.g. 1.4"
              disabled={updateMutation.isPending}
            />
            <Input
              aria-label="Name"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Name, e.g. Vendetta"
              disabled={updateMutation.isPending}
            />
          </div>
          <Textarea
            aria-label="Comments"
            value={draft.comments}
            onChange={(e) => setDraft({ ...draft, comments: e.target.value })}
            placeholder="Notes about this version, source links, change summary..."
            rows={4}
            disabled={updateMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
