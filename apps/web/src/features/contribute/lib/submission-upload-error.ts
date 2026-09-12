import { m } from "@/paraglide/messages.js";

export function uploadImageErrorMessage(status: number): string {
  switch (status) {
    case 400: {
      return m.contribute_upload_error_not_image();
    }
    case 413: {
      return m.contribute_upload_error_too_large();
    }
    case 429: {
      return m.contribute_upload_error_rate_limited();
    }
    default: {
      return m.contribute_upload_error_generic();
    }
  }
}
