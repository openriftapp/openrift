import { m } from "@/paraglide/messages.js";

/**
 * Browsers reject with `DOMException`s whose messages are written for
 * developers, not users; Firefox rejects a machine with no usable camera with
 * NotFoundError and "The object can not be found here." before any prompt.
 */
export function cameraErrorMessage(thrown: unknown, fallback: string): string {
  // DOMException is checked separately: it only gained Error in its prototype
  // chain in later engine versions, and jsdom's still lacks it.
  if (!(thrown instanceof Error || thrown instanceof DOMException)) {
    return fallback;
  }
  switch (thrown.name) {
    case "NotFoundError":
    case "DevicesNotFoundError": {
      return m.scan_camera_error_not_found();
    }
    case "NotAllowedError":
    case "PermissionDeniedError": {
      return m.scan_camera_error_blocked();
    }
    case "NotReadableError":
    case "TrackStartError": {
      return m.scan_camera_error_not_readable();
    }
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError": {
      return m.scan_camera_error_overconstrained();
    }
    case "SecurityError": {
      return m.scan_camera_error_security();
    }
    default: {
      return thrown.message || fallback;
    }
  }
}
