import { useEffect, useState } from "react";

import { sha256Hex } from "@/lib/gravatar";

/** Use only when the caller already owns the email; other users get a server-computed hash instead. */
export function useGravatarHash(email: string | undefined): string | undefined {
  const [hash, setHash] = useState<string>();

  useEffect(() => {
    if (!email) {
      return;
    }
    let cancelled = false;
    void (async () => {
      // A digest failure leaves the avatar on its initials fallback.
      const computed = await sha256Hex(email.trim().toLowerCase()).catch(() => null);
      if (computed !== null && !cancelled) {
        setHash(computed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return hash;
}
