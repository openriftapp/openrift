import type { ColumnType } from "kysely";

export type CreatedAt = ColumnType<Date, Date | undefined, Date>;

export type UpdatedAt = ColumnType<Date, Date | undefined, Date>;

/** Transaction id stamped by a database trigger; never written by application code. */
export type UpdatedXid = ColumnType<string, never, never>;
