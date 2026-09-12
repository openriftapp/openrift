import { m } from "@/paraglide/messages.js";

const UPLOAD_STATUS_MESSAGES: Record<number, () => string> = {
  400: m.groups_banner_error_type,
  403: m.groups_banner_error_role,
  413: m.groups_banner_error_size,
  429: m.groups_banner_error_quota,
};

export function bannerUploadErrorMessage(status: number): string {
  return UPLOAD_STATUS_MESSAGES[status]?.() ?? m.groups_banner_error_generic();
}
