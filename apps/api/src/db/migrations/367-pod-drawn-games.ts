import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE pods
      ADD COLUMN drawn_games integer NOT NULL DEFAULT 0,
      ADD CONSTRAINT chk_pods_drawn_games CHECK (drawn_games >= 0)
  `.execute(db);
  // A 0–0 match result saved before drawn games existed was a draw: one drawn
  // game in Bo1, an intentional draw (0–0–3) in Bo3.
  await sql`
    UPDATE pods p
       SET drawn_games = CASE t.match_format WHEN 'bo1' THEN 1 ELSE 3 END
      FROM pod_rounds r
      JOIN tournaments t ON t.id = r.tournament_id
     WHERE r.id = p.round_id
       AND p.result_status = 'reported'
       AND (p.size = 2 OR t.play_mode = '2v2')
       AND NOT EXISTS (
         SELECT 1
           FROM pod_members m
          WHERE m.pod_id = p.id
            AND (m.game_points IS DISTINCT FROM 0 OR m.placement IS NULL)
       )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE pods DROP COLUMN drawn_games`.execute(db);
}
