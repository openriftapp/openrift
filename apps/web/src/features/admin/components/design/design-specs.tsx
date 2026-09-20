import type { ReactNode } from "react";
import { createContext, use, useState } from "react";

import { useHydrated } from "@/hooks/use-hydrated";

const SPECS_STORAGE_KEY = "openrift.design.specs";

interface DesignSpecsValue {
  showSpecs: boolean;
  setShowSpecs: (value: boolean) => void;
}

function readStoredSpecs(): boolean {
  try {
    return globalThis.localStorage.getItem(SPECS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredSpecs(value: boolean): void {
  try {
    globalThis.localStorage.setItem(SPECS_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Storage throws in private mode and wherever site data is blocked.
  }
}

const DesignSpecsContext = createContext<DesignSpecsValue | null>(null);

export function DesignSpecsProvider({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const [showSpecs, setShowSpecs] = useState(false);
  const [readStored, setReadStored] = useState(false);
  if (hydrated && !readStored) {
    setReadStored(true);
    setShowSpecs(readStoredSpecs());
  }

  function persistShowSpecs(value: boolean) {
    setShowSpecs(value);
    writeStoredSpecs(value);
  }

  return (
    <DesignSpecsContext value={{ showSpecs, setShowSpecs: persistShowSpecs }}>
      {children}
    </DesignSpecsContext>
  );
}

export function useDesignSpecs(): DesignSpecsValue {
  const value = use(DesignSpecsContext);
  if (!value) {
    throw new Error("useDesignSpecs needs a DesignSpecsProvider above it.");
  }
  return value;
}

export function useShowSpecs(): boolean {
  return use(DesignSpecsContext)?.showSpecs ?? false;
}
