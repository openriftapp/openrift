import { DAY_MS } from "@openrift/shared/format-date";

const COPY_DELETION_RETENTION_DAYS = 30;

export const COPY_DELETION_RETENTION_MS = COPY_DELETION_RETENTION_DAYS * DAY_MS;
