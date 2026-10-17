import { useState } from "react";

export function useMountedAt(): Date {
  // oxlint-disable-next-line react/hook-use-state -- read-only, no setter needed
  const [mountedAt] = useState(() => new Date());
  return mountedAt;
}
