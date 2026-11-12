import type { AdminPrintingImageResponse } from "@openrift/shared/types/api/admin";

export type RehostStatus = "rehosted" | "pending" | "failed" | "not-rehosted";

export function rehostStatus(
  image: Pick<AdminPrintingImageResponse, "rehostedUrl" | "activateWhenRehosted" | "rehostFailure">,
): RehostStatus {
  if (image.rehostedUrl !== null) {
    return "rehosted";
  }
  if (image.rehostFailure !== null) {
    return "failed";
  }
  return image.activateWhenRehosted ? "pending" : "not-rehosted";
}

export function rehostStatusTitle(
  image: Pick<AdminPrintingImageResponse, "rehostedUrl" | "activateWhenRehosted" | "rehostFailure">,
): string {
  switch (rehostStatus(image)) {
    case "rehosted": {
      return "Copied to our server";
    }
    case "pending": {
      return "Becomes the active image once the copy to our server finishes";
    }
    case "failed": {
      const failure = image.rehostFailure;
      const attempts = failure?.attempts ?? 1;
      const tries = attempts === 1 ? "1 attempt" : `${attempts} attempts`;
      const pending = image.activateWhenRehosted
        ? " It becomes the active image once a retry succeeds."
        : "";
      return `Copy to our server failed after ${tries}: ${failure?.error ?? "unknown error"}.${pending}`;
    }
    case "not-rehosted": {
      return "Only reviewers see this image until it is copied to our server";
    }
  }
}
