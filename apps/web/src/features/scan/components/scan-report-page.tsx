import { formatDayTimeLocal } from "@openrift/shared/format-date";
import { useState } from "react";

import { PageTopBar, PageTopBarSticky, PageTopBarTitle } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSendScanReport } from "@/features/scan/hooks/use-scan-report";
import type { ScanJournalEntry } from "@/features/scan/lib/scan-journal";
import { readScanJournal } from "@/features/scan/lib/scan-journal";
import { cn, FORM_COLUMN, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function summarize(journal: readonly ScanJournalEntry[]): string {
  const first = journal[0];
  const last = journal.at(-1);
  if (first === undefined || last === undefined) {
    return m.scan_report_nothing();
  }
  const batches = new Set<string>();
  for (const entry of journal) {
    if (entry.type === "add-start") {
      batches.add(entry.batchId);
    }
  }
  return m.scan_report_summary({
    count: journal.length,
    entries: m.scan_report_entry({ count: journal.length }),
    from: formatDayTimeLocal(new Date(first.t)),
    to: formatDayTimeLocal(new Date(last.t)),
    batchCount: batches.size,
    batches: m.scan_report_batch({ count: batches.size }),
  });
}

export function ScanReportPage() {
  const [journal, setJournal] = useState<ScanJournalEntry[]>(readScanJournal);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState<string | null>(null);
  const sendReport = useSendScanReport();

  const trimmedNote = note.trim();
  const nothingToSend = journal.length === 0 && trimmedNote.length === 0;

  async function handleSend() {
    let noteToSend: string | undefined;
    if (trimmedNote.length > 0) {
      noteToSend = trimmedNote;
    }
    const userAgent = navigator.userAgent.slice(0, 500);
    try {
      const sent = await sendReport.mutateAsync({ note: noteToSend, userAgent, journal });
      setReference(sent.reference);
      setJournal(readScanJournal());
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.scan_report_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>

      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-12")}>
        <p>{m.scan_report_intro()}</p>

        {reference === null ? (
          <div className={cn("flex flex-col gap-4", FORM_COLUMN)}>
            <p className="text-muted-foreground">{summarize(journal)}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="scan-report-note">{m.scan_report_note_label()}</Label>
              <Textarea
                id="scan-report-note"
                value={note}
                rows={5}
                maxLength={2000}
                placeholder={m.scan_report_note_placeholder()}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div>
              <Button
                disabled={nothingToSend || sendReport.isPending}
                onClick={() => void handleSend()}
              >
                {sendReport.isPending ? m.scan_report_sending() : m.scan_report_send()}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-heading text-4xl font-bold">{reference}</p>
            <p>{m.scan_report_reference_hint()}</p>
          </div>
        )}
      </div>
    </>
  );
}
