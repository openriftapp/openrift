import type { FriendGroupResponse } from "@openrift/shared/types/api/friend-group";

import { bannerUploadErrorMessage } from "@/features/groups/lib/banner-upload-error";
import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { useRequiredUserId } from "@/lib/auth-session";
import { ApiError } from "@/lib/server-fns/api-error";
import { useMutationWithInvalidation } from "@/lib/use-mutation-with-invalidation";

// Multipart goes straight to the API: a server function would have to
// base64 the file through the SSR boundary first.
async function uploadBanner(slug: string, file: File): Promise<FriendGroupResponse> {
  const path = `/api/v1/friend-groups/${encodeURIComponent(slug)}/banner`;
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${globalThis.location.origin}${path}`, {
    method: "POST",
    body,
    credentials: "include",
  });
  if (!response.ok) {
    throw new ApiError(bannerUploadErrorMessage(response.status), {
      status: response.status,
      diagnostic: `POST ${path} → ${response.status}`,
    });
  }
  return (await response.json()) as FriendGroupResponse;
}

export function useUploadGroupBanner() {
  const userId = useRequiredUserId();
  return useMutationWithInvalidation<FriendGroupResponse, { slug: string; file: File }>({
    mutationFn: ({ slug, file }) => uploadBanner(slug, file),
    invalidates: (variables) => [
      friendGroupsKeys.all(userId),
      friendGroupsKeys.detail(userId, variables.slug),
    ],
  });
}
