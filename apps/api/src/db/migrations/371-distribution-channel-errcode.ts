import type { Kysely } from "kysely";
import { sql } from "kysely";

// HIERARCHY_REJECTED_SQLSTATE in src/lib/pg-errors.ts; the API maps only this code to a 409.
const HIERARCHY_REJECTED = "USING ERRCODE = 'OR001'";

function validateFunction(using: string) {
  const errcode = sql.raw(using === "" ? "" : ` ${using}`);
  return sql`
    CREATE OR REPLACE FUNCTION trg_distribution_channels_validate() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      parent_kind text;
      cursor_id uuid;
      depth int := 0;
    BEGIN
      IF NEW.parent_id IS NOT NULL THEN
        SELECT kind INTO parent_kind FROM distribution_channels WHERE id = NEW.parent_id;
        IF parent_kind IS NULL THEN
          RAISE EXCEPTION 'Parent distribution channel % not found', NEW.parent_id${errcode};
        END IF;
        IF parent_kind <> NEW.kind THEN
          RAISE EXCEPTION 'Child channel kind (%) must match parent kind (%)',
            NEW.kind, parent_kind${errcode};
        END IF;

        cursor_id := NEW.parent_id;
        WHILE cursor_id IS NOT NULL AND depth < 32 LOOP
          IF cursor_id = NEW.id THEN
            RAISE EXCEPTION 'Cycle detected in distribution channel hierarchy'${errcode};
          END IF;
          SELECT parent_id INTO cursor_id FROM distribution_channels WHERE id = cursor_id;
          depth := depth + 1;
        END LOOP;
        IF depth >= 32 THEN
          RAISE EXCEPTION 'Distribution channel hierarchy exceeds maximum depth'${errcode};
        END IF;

        IF EXISTS (
          SELECT 1 FROM printing_distribution_channels WHERE channel_id = NEW.parent_id
        ) THEN
          RAISE EXCEPTION 'Cannot attach child under channel % because it already has printings',
            NEW.parent_id${errcode};
        END IF;
      END IF;

      IF TG_OP = 'UPDATE' AND NEW.kind IS DISTINCT FROM OLD.kind THEN
        IF EXISTS (
          SELECT 1 FROM distribution_channels WHERE parent_id = NEW.id AND kind <> NEW.kind
        ) THEN
          RAISE EXCEPTION 'Cannot change kind of % because children have a different kind',
            NEW.id${errcode};
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$
  `;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  await validateFunction(HIERARCHY_REJECTED).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await validateFunction("").execute(db);
}
