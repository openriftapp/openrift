import { Loader2Icon, PrinterIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BinderSheetPaper,
  BinderSheetSize,
  BinderSheetStyle,
} from "@/features/collections/lib/binder-sheet-specs";
import {
  BINDER_SHEET_PAPERS,
  BINDER_SHEET_SPECS,
  binderSheetPaperLabel,
  binderSheetSizeHint,
  binderSheetSizeLabel,
} from "@/features/collections/lib/binder-sheet-specs";
import { m } from "@/paraglide/messages.js";

export interface BinderSheetPanelProps {
  shareUrl: string;
  defaultTitle: string;
  defaultSubtitle: string;
  filenameHint?: string;
}

function sizeItems(): { value: BinderSheetSize; label: string }[] {
  return (Object.keys(BINDER_SHEET_SPECS) as BinderSheetSize[]).map((value) => ({
    value,
    label: binderSheetSizeLabel(value),
  }));
}

function paperItems(): { value: BinderSheetPaper; label: string }[] {
  return (Object.keys(BINDER_SHEET_PAPERS) as BinderSheetPaper[]).map((value) => ({
    value,
    label: binderSheetPaperLabel(value),
  }));
}

function styleItems(): { value: BinderSheetStyle; label: string }[] {
  return [
    { value: "light", label: m.binder_style_light() },
    { value: "dark", label: m.binder_style_dark() },
  ];
}

/**
 * Module scope, not the handler: react-compiler cannot lower an `import()`
 * expression inside a component and bails on the whole file.
 */
async function loadBinderSheetGenerator() {
  const module = await import("@/features/collections/lib/binder-sheet-pdf");
  return module.generateBinderSheetPdf;
}

export function BinderSheetPanel({
  shareUrl,
  defaultTitle,
  defaultSubtitle,
  filenameHint,
}: BinderSheetPanelProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [contact, setContact] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [cutMarks, setCutMarks] = useState(false);
  const [ruler, setRuler] = useState(false);
  const [size, setSize] = useState<BinderSheetSize>("card");
  const [paper, setPaper] = useState<BinderSheetPaper>("a4");
  const [style, setStyle] = useState<BinderSheetStyle>("light");
  const [generating, setGenerating] = useState(false);

  const sizes = sizeItems();
  const papers = paperItems();
  const styles = styleItems();

  const handleCreate = async () => {
    setGenerating(true);
    const generateBinderSheetPdf = await loadBinderSheetGenerator();
    // React Compiler can't yet lower try/finally; reset in both paths instead.
    try {
      await generateBinderSheetPdf({
        shareUrl,
        title: title.trim(),
        subtitle: subtitle.trim(),
        contact: contact.trim(),
        showLink,
        cutMarks,
        ruler,
        size,
        paper,
        style,
        filenameHint,
      });
      setGenerating(false);
    } catch {
      toast.error(m.binder_error());
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="binder-sheet-title">{m.binder_title_label()}</Label>
          <Input
            id="binder-sheet-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="binder-sheet-subtitle">{m.binder_subtitle_label()}</Label>
          <Input
            id="binder-sheet-subtitle"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="binder-sheet-contact">{m.binder_contact_label()}</Label>
          <Input
            id="binder-sheet-contact"
            value={contact}
            placeholder={m.binder_contact_placeholder()}
            onChange={(event) => setContact(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor="binder-sheet-size">{m.binder_size_label()}</Label>
          <Select
            items={sizes}
            value={size}
            onValueChange={(value) => setSize(value as BinderSheetSize)}
          >
            <SelectTrigger id="binder-sheet-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-sm">{binderSheetSizeHint(size)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="binder-sheet-paper">{m.binder_paper_label()}</Label>
            <Select
              items={papers}
              value={paper}
              onValueChange={(value) => setPaper(value as BinderSheetPaper)}
            >
              <SelectTrigger id="binder-sheet-paper" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {papers.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="binder-sheet-style">{m.binder_style_label()}</Label>
            <Select
              items={styles}
              value={style}
              onValueChange={(value) => setStyle(value as BinderSheetStyle)}
            >
              <SelectTrigger id="binder-sheet-style" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {styles.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="binder-sheet-show-link"
              checked={showLink}
              onCheckedChange={(checked) => setShowLink(checked === true)}
            />
            <label htmlFor="binder-sheet-show-link" className="cursor-pointer text-sm">
              {m.binder_show_link()}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="binder-sheet-cut-marks"
              checked={cutMarks}
              onCheckedChange={(checked) => setCutMarks(checked === true)}
            />
            <label htmlFor="binder-sheet-cut-marks" className="cursor-pointer text-sm">
              {size === "card" ? m.binder_cut_marks_card() : m.binder_cut_marks_sheet()}
            </label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="binder-sheet-ruler"
              checked={ruler}
              onCheckedChange={(checked) => setRuler(checked === true)}
            />
            <label htmlFor="binder-sheet-ruler" className="cursor-pointer text-sm">
              {m.binder_ruler()}
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">{m.binder_print_scale_note()}</p>
        <Button className="self-start" onClick={() => void handleCreate()} disabled={generating}>
          {generating ? (
            <>
              <Loader2Icon className="animate-spin" />
              {m.binder_creating()}
            </>
          ) : (
            <>
              <PrinterIcon />
              {m.binder_create_pdf()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
