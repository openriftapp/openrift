import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import type { InstallPlatform } from "@/lib/install-platform";
import { detectInstallPlatform } from "@/lib/install-platform";

// The server never sees maxTouchPoints, so an iPad in desktop mode is told
// apart only after hydration.
export const requestInstallPlatform = createIsomorphicFn()
  .server((): InstallPlatform =>
    detectInstallPlatform(getRequest().headers.get("user-agent") ?? ""),
  )
  .client((): InstallPlatform =>
    detectInstallPlatform(globalThis.navigator.userAgent, navigator.maxTouchPoints),
  );
