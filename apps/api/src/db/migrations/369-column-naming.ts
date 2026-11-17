import type { Kysely } from "kysely";
import { sql } from "kysely";

const COLUMNS: [table: string, from: string, to: string][] = [
  ["card_card_types", "position", "sort_order"],
  ["card_domains", "ordinal", "sort_order"],
  ["meta_deck_inference_neighbours", "position", "sort_order"],

  ["card_trades", "giver_account_closed", "is_giver_account_closed"],
  ["card_trades", "receiver_account_closed", "is_receiver_account_closed"],
  ["collection_deckbuilding_prefs", "available", "is_available"],
  ["collection_sidebar_prefs", "hidden", "is_hidden"],
  ["copy_deletion_sweep", "only_row", "is_only_row"],
  ["deck_plans", "battlefield_custom", "is_battlefield_custom"],
  ["deck_plans", "mulligan_split", "has_mulligan_split"],
  ["face_images", "activate_when_rehosted", "is_activation_pending"],
  ["feature_flags", "enabled", "is_enabled"],
  ["job_runs", "noop", "is_noop"],
  ["keywords", "card_modifier", "is_card_modifier"],
  ["keywords", "cost_keyword", "is_cost_keyword"],
  ["keywords", "dark_text", "has_dark_text"],
  ["lists", "cardmarket_sync", "has_cardmarket_sync"],
  ["lists", "sidebar_hidden", "is_sidebar_hidden"],
  ["loans", "borrower_account_closed", "is_borrower_account_closed"],
  ["meta_deck_inferences", "champion_unsure", "is_champion_unsure"],
  ["meta_event_sources", "contributes", "is_contributing"],
  ["meta_sync_settings", "auto_accept_notable", "has_auto_accept_notable"],
  ["meta_sync_settings", "auto_accept_official", "has_auto_accept_official"],
  ["provider_settings", "helper_reviewable", "is_helper_reviewable"],
  ["tournament_participants", "account_closed", "is_account_closed"],
  ["tournaments", "cut_rematch_avoidance", "has_cut_rematch_avoidance"],
  ["tournaments", "groups_self_paced", "has_self_paced_groups"],
  ["tournaments", "legend_tiebreak", "has_legend_tiebreak"],
  ["tournaments", "published", "is_published"],
  ["tournaments", "regions_enabled", "has_regions"],
  ["tournaments", "self_registration", "has_self_registration"],
  ["user_feature_flags", "enabled", "is_enabled"],
  ["users", "profile_show_collection", "is_profile_collection_shown"],
  ["users", "profile_show_last_active", "is_profile_last_active_shown"],
  ["users", "profile_show_referral_tier", "is_profile_referral_tier_shown"],
  ["users", "profile_show_riot_id", "is_profile_riot_id_shown"],
  ["uvsgames_event_templates", "watched", "is_watched"],

  ["deck_check_entries", "approved_by", "approved_by_user_id"],
  ["deck_check_entries", "checked_by", "checked_by_user_id"],
  ["deck_check_keys", "created_by", "created_by_user_id"],
  ["friend_groups", "banner_uploaded_by", "banner_uploaded_by_user_id"],

  ["formats", "id", "slug"],
  ["formats", "name", "label"],
];

const TABLES: [from: string, to: string][] = [
  ["formats", "ban_formats"],
  ["friend_group_shops", "friend_group_uvsgames_shops"],
];

// plpgsql bodies are not rewritten by RENAME COLUMN.
function snapshotDeletedUserNames(closed: (column: string) => string) {
  return sql`
    CREATE OR REPLACE FUNCTION snapshot_deleted_user_names() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      DELETE FROM card_trade_copies
       WHERE trade_id IN (
         SELECT id FROM card_trades
          WHERE (giver_user_id = OLD.id OR receiver_user_id = OLD.id)
            AND status IN ('pending', 'reserved')
       );

      UPDATE card_trades
         SET status = 'cancelled',
             closed_at = now(),
             expires_at = NULL,
             last_actor_user_id = NULL
       WHERE (giver_user_id = OLD.id OR receiver_user_id = OLD.id)
         AND status IN ('pending', 'reserved');

      UPDATE card_trades
         SET giver_user_id = NULL, giver_name = NULL,
             ${sql.ref(closed("giver_account_closed"))} = true
       WHERE giver_user_id = OLD.id;

      UPDATE card_trades
         SET receiver_user_id = NULL, receiver_name = NULL,
             ${sql.ref(closed("receiver_account_closed"))} = true
       WHERE receiver_user_id = OLD.id;

      UPDATE loans
         SET borrower_user_id = NULL, borrower_name = NULL,
             ${sql.ref(closed("borrower_account_closed"))} = true
       WHERE borrower_user_id = OLD.id;

      UPDATE tournament_participants
         SET user_id = NULL,
             display_name = NULL,
             riot_id = NULL,
             claim_token = NULL,
             ${sql.ref(closed("account_closed"))} = true
       WHERE user_id = OLD.id;

      RETURN OLD;
    END;
    $$
  `;
}

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const [table, from, to] of COLUMNS) {
    await sql`ALTER TABLE ${sql.ref(table)} RENAME COLUMN ${sql.ref(from)} TO ${sql.ref(to)}`.execute(
      db,
    );
  }

  await sql`ALTER TABLE formats ADD COLUMN sort_order smallint`.execute(db);
  await sql`
    UPDATE formats f
       SET sort_order = ranked.rn
      FROM (SELECT slug, row_number() OVER (ORDER BY label) AS rn FROM formats) ranked
     WHERE ranked.slug = f.slug
  `.execute(db);
  // The deferred catalog-version trigger queued by the UPDATE blocks further ALTERs until it fires.
  await sql`SET CONSTRAINTS ALL IMMEDIATE`.execute(db);
  await sql`ALTER TABLE formats ALTER COLUMN sort_order SET NOT NULL`.execute(db);

  for (const [from, to] of TABLES) {
    await sql`ALTER TABLE ${sql.ref(from)} RENAME TO ${sql.ref(to)}`.execute(db);
  }

  await snapshotDeletedUserNames((column) => `is_${column}`).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [from, to] of TABLES) {
    await sql`ALTER TABLE ${sql.ref(to)} RENAME TO ${sql.ref(from)}`.execute(db);
  }
  await sql`ALTER TABLE formats DROP COLUMN sort_order`.execute(db);

  for (const [table, from, to] of COLUMNS.toReversed()) {
    await sql`ALTER TABLE ${sql.ref(table)} RENAME COLUMN ${sql.ref(to)} TO ${sql.ref(from)}`.execute(
      db,
    );
  }

  await snapshotDeletedUserNames((column) => column).execute(db);
}
