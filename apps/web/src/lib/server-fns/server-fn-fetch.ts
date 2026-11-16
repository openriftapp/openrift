import { isNotFound } from "@tanstack/react-router";
import type { CustomFetch } from "@tanstack/react-start";
import { X_TSS_RAW_RESPONSE, X_TSS_SERIALIZED } from "@tanstack/react-start";

import { apiFetch, discardBody } from "@/lib/api-fetch";
import { STALE_SERVER_FN_HEADER, StaleServerFnError } from "@/lib/stale-server-fn-signal";

import { apiErrorFromResponse } from "./api-error";

function startHandled(response: Response): boolean {
  return response.headers.has(X_TSS_SERIALIZED) || response.headers.has(X_TSS_RAW_RESPONSE);
}

async function isRouterSignal(response: Response): Promise<boolean> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return (
    isNotFound(body) ||
    (typeof body === "object" &&
      body !== null &&
      (body as { isSerializedRedirect?: unknown }).isSerializedRedirect === true)
  );
}

const LOGGED_BODY_LIMIT = 500;

function cappedBody(response: Response) {
  return {
    status: response.status,
    statusText: response.statusText,
    text: async () => {
      const body = await response.text();
      return body.slice(0, LOGGED_BODY_LIMIT);
    },
  };
}

// Start's serverFnFetcher returns a non-ok JSON body it did not serialize as the result and
// throws any other one as raw text. Remove once Start rejects both with a status.
export const serverFnFetch: CustomFetch = async (input, init) => {
  const response = await apiFetch(input, init);
  const url = input instanceof Request ? input.url : String(input);
  if (response.headers.has(STALE_SERVER_FN_HEADER)) {
    void discardBody(response);
    throw new StaleServerFnError(url);
  }
  if (response.ok || startHandled(response)) {
    return response;
  }
  const json = response.headers.get("content-type")?.includes("application/json") === true;
  if (json && (await isRouterSignal(response))) {
    return response;
  }
  throw await apiErrorFromResponse(
    json ? response : cappedBody(response),
    "Server function failed",
    { method: init?.method, url },
    "",
  );
};
