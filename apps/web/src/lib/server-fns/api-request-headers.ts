import { createIsomorphicFn } from "@tanstack/react-start";

import { serverApiRequestHeaders } from "./api-trace-headers";

export const apiRequestHeaders = createIsomorphicFn()
  .server(serverApiRequestHeaders)
  .client((cookie?: string): Record<string, string> => (cookie === undefined ? {} : { cookie }));
