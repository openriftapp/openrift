import type { FriendGroupResponse } from "@openrift/shared/types/api/friend-group";

import { bannerUploadErrorMessage } from "@/features/groups/lib/banner-upload-error";
import { friendGroupsKeys } from "@/features/groups/lib/groups-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { useRequiredUserId } from "@/hooks/use-session";
import { postMultipart } from "@/lib/server-fns/upload";

function uploadBanner(slug: string, file: File): Promise<FriendGroupResponse> {
  const body = new FormData();
  body.append("file", file);
  return postMultipart<FriendGroupResponse>(
    `/api/v1/friend-groups/${encodeURIComponent(slug)}/banner`,
    body,
    { messageForStatus: bannerUploadErrorMessage },
  );
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
