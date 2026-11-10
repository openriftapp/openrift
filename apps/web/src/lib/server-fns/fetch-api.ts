// oxlint-disable-next-line import/no-unassigned-import -- import-protection marker
import "@tanstack/react-start/server-only";
import { fetchWithDeadline } from "./api-deadline";
import { apiErrorFromResponse } from "./api-error";
import { serverApiRequestHeaders } from "./api-trace-headers";
import { getApiUrl } from "./api-url";

interface FetchApiOptions {
  errorTitle: string;
  cookie?: string;
  path: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  acceptStatuses?: readonly number[];
}

// Throws ApiError on a non-2xx response not listed in acceptStatuses; otherwise returns the Response untouched.
export async function fetchApi(options: FetchApiOptions): Promise<Response> {
  const {
    errorTitle,
    cookie,
    path,
    method = "GET",
    body,
    headers: extraHeaders,
    acceptStatuses,
  } = options;
  const url = `${getApiUrl()}${path}`;
  const headers: Record<string, string> = { ...extraHeaders, ...serverApiRequestHeaders(cookie) };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetchWithDeadline(
    url,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    errorTitle,
  );
  if (!res.ok && !acceptStatuses?.includes(res.status)) {
    throw await apiErrorFromResponse(res, errorTitle, { method, url });
  }
  return res;
}

export async function fetchApiJson<T>(options: FetchApiOptions): Promise<T> {
  const res = await fetchApi(options);
  return res.json() as Promise<T>;
}
