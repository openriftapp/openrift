import type { Kysely } from "kysely";
import { sql } from "kysely";

const LABELS: readonly (readonly [keyword: string, language: "FR" | "KR", label: string])[] = [
  ["Accelerate", "FR", "Accélération"],
  ["Action", "FR", "Action"],
  ["Add", "FR", "Ajout"],
  ["Ambush", "FR", "Embuscade"],
  ["Assault", "FR", "Assaut"],
  ["Backline", "FR", "Arrière-ligne"],
  ["Buff", "FR", "Buff"],
  ["Burn", "FR", "Brûler"],
  ["Deathknell", "FR", "Agonie"],
  ["Deflect", "FR", "Protection"],
  ["Empower", "FR", "Amplification"],
  ["Equip", "FR", "Équiper"],
  ["Flow", "FR", "Flux"],
  ["Ganking", "FR", "Gank"],
  ["Hidden", "FR", "Caché"],
  ["Hunt", "FR", "Chasse"],
  ["Legion", "FR", "Légion"],
  ["Level", "FR", "Niveau"],
  ["Mighty", "FR", "Puissant"],
  ["Predict", "FR", "Prédiction"],
  ["Quick-Draw", "FR", "Dégainer"],
  ["Reaction", "FR", "Réaction"],
  ["Repeat", "FR", "Répétition"],
  ["Shield", "FR", "Bouclier"],
  ["Stun", "FR", "Étourdissement"],
  ["Tank", "FR", "Tank"],
  ["Temporary", "FR", "Temporaire"],
  ["Unique", "FR", "Unique"],
  ["Vision", "FR", "Vision"],
  ["Weaponmaster", "FR", "Expert en armes"],
  ["Ambush", "KR", "매복"],
  ["Backline", "KR", "후방"],
  ["Buff", "KR", "버프"],
  ["Burn", "KR", "소각"],
  ["Empower", "KR", "강화"],
  ["Empowered", "KR", "강화됨"],
  ["Equip", "KR", "장착"],
  ["Flow", "KR", "흐름"],
  ["Hunt", "KR", "사냥"],
  ["Level", "KR", "레벨"],
  ["Predict", "KR", "예측"],
  ["Quick-Draw", "KR", "빨리 뽑기"],
  ["Repeat", "KR", "반복"],
  ["Stun", "KR", "기절"],
  ["Unique", "KR", "고유"],
  ["Weaponmaster", "KR", "무기의 대가"],
];

export async function up(db: Kysely<unknown>): Promise<void> {
  for (const [keyword, language, label] of LABELS) {
    await sql`
      INSERT INTO keyword_translations (keyword_name, language, label)
      SELECT name, ${language}, ${label} FROM keywords
      WHERE name = ${keyword} AND EXISTS (SELECT 1 FROM languages WHERE code = ${language})
      ON CONFLICT (keyword_name, language) DO NOTHING
    `.execute(db);
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const [keyword, language, label] of LABELS) {
    await sql`
      DELETE FROM keyword_translations
      WHERE keyword_name = ${keyword} AND language = ${language} AND label = ${label}
    `.execute(db);
  }
}
