import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogCancel, DialogContent, DialogFooter } from "@/components/ui/dialog";

export interface DeckFormControls {
  onClose: () => void;
  onSavingChange: (saving: boolean) => void;
}

export function DeckFormDialog({
  open,
  onOpenChange,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: (controls: DeckFormControls) => ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState({ open, id: 0 });
  if (session.open !== open) {
    setSession({ open, id: open ? session.id + 1 : session.id });
  }
  if (!open && saving) {
    setSaving(false);
  }
  const currentSession = useRef(session.id);
  useEffect(() => {
    currentSession.current = session.id;
  }, [session.id]);

  const owner = session.id;
  const controls: DeckFormControls = {
    onClose: () => {
      if (currentSession.current === owner) {
        onOpenChange(false);
      }
    },
    onSavingChange: (next) => {
      if (currentSession.current === owner) {
        setSaving(next);
      }
    },
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen || !saving) {
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className={className} closeDisabled={saving}>
        <DeckFormBody key={owner} controls={controls}>
          {children}
        </DeckFormBody>
      </DialogContent>
    </Dialog>
  );
}

function DeckFormBody({
  controls,
  children,
}: {
  controls: DeckFormControls;
  children: (controls: DeckFormControls) => ReactNode;
}) {
  return children(controls);
}

export function DeckFormFooter({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <DialogFooter>
      <DialogCancel disabled={pending} />
      {children}
    </DialogFooter>
  );
}
