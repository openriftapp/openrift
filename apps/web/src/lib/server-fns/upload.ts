import { apiFetch } from "@/lib/api-fetch";
import { ApiError } from "@/lib/server-fns/api-error";

/**
 * POSTs multipart form data straight to the API from the browser; a server
 * function would have to base64 the file through the SSR boundary first.
 */
export async function postMultipart<T>(
  path: string,
  formData: FormData,
  { messageForStatus }: { messageForStatus: (status: number) => string },
): Promise<T> {
  const response = await apiFetch(`${globalThis.location.origin}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(messageForStatus(response.status), {
      status: response.status,
      diagnostic: `POST ${path} → ${response.status}`,
    });
  }
  return (await response.json()) as T;
}
