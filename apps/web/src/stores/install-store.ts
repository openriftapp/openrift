import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  promptEvent: BeforeInstallPromptEvent | null;
  visitDays: number;
  lastVisitDay: string | null;
  nudgeDismissed: boolean;
  installedToastShown: boolean;
  setPromptEvent: (event: BeforeInstallPromptEvent | null) => void;
  recordVisit: (day: string) => void;
  dismissNudge: () => void;
  markInstalledToastShown: () => void;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

export const useInstallStore = create<InstallState>()(
  persist(
    (set, get) => ({
      promptEvent: null,
      visitDays: 0,
      lastVisitDay: null,
      nudgeDismissed: false,
      installedToastShown: false,
      setPromptEvent: (event) => set({ promptEvent: event }),
      recordVisit: (day) => {
        if (get().lastVisitDay === day) {
          return;
        }
        set((state) => ({ visitDays: state.visitDays + 1, lastVisitDay: day }));
      },
      dismissNudge: () => set({ nudgeDismissed: true }),
      markInstalledToastShown: () => set({ installedToastShown: true }),
      promptInstall: async () => {
        const event = get().promptEvent;
        if (!event) {
          return "unavailable";
        }
        // A prompt event is single-use.
        set({ promptEvent: null });
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome;
      },
    }),
    {
      name: "openrift-install",
      partialize: (state) => ({
        visitDays: state.visitDays,
        lastVisitDay: state.lastVisitDay,
        nudgeDismissed: state.nudgeDismissed,
        installedToastShown: state.installedToastShown,
      }),
      merge: (persisted, current) => {
        const raw = persisted as Record<string, unknown> | undefined;
        return {
          ...current,
          visitDays: typeof raw?.visitDays === "number" ? raw.visitDays : current.visitDays,
          lastVisitDay:
            typeof raw?.lastVisitDay === "string" ? raw.lastVisitDay : current.lastVisitDay,
          nudgeDismissed: raw?.nudgeDismissed === true,
          installedToastShown: raw?.installedToastShown === true,
        };
      },
    },
  ),
);

// Chrome fires beforeinstallprompt once, often before the install page has
// loaded, so the listener goes on at startup and the event waits in the store.
export function initInstallPromptCapture(target: EventTarget = globalThis): void {
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    useInstallStore.getState().setPromptEvent(event as BeforeInstallPromptEvent);
  });
  target.addEventListener("appinstalled", () => {
    useInstallStore.getState().setPromptEvent(null);
  });
}
