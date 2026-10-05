import { z } from "zod";

export const BOARD_STATE_SCHEMA_VERSION = 3;
export const BOARD_PLAYERS = ["A", "B", "C", "D"] as const;
export const MAX_BATTLEFIELDS = 3;
export const MAX_BOARD_STEPS = 20;
export const MAX_STEP_PIECES = 60;
export const MAX_PIECE_KEYWORDS = 6;
export const MAX_CHAIN_ENTRIES = 20;
export const MAX_PIECE_BUFFS = 9;

export type BoardPlayer = (typeof BOARD_PLAYERS)[number];

export const PLAYER_ZONE_KINDS = [
  "base",
  "legend",
  "champion",
  "runes",
  "hand",
  "trash",
  "banishment",
  "deck",
  "runeDeck",
] as const;
export type PlayerZoneKind = (typeof PLAYER_ZONE_KINDS)[number];

export const PIECE_KINDS = ["unit", "spell", "gear", "rune", "legend", "token"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

export const CHAIN_ENTRY_TYPES = ["spell", "triggered", "activated"] as const;
export type ChainEntryType = (typeof CHAIN_ENTRY_TYPES)[number];

export const ARROW_KINDS = ["move", "target", "recall"] as const;
export type ArrowKind = (typeof ARROW_KINDS)[number];

export const TURN_PHASES = ["awaken", "beginning", "channel", "draw", "main", "ending"] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

export const TURN_STATES = [
  "neutral-open",
  "neutral-closed",
  "showdown-open",
  "showdown-closed",
] as const;
export type TurnState = (typeof TURN_STATES)[number];

export const BATTLEFIELD_ENCOUNTERS = ["showdown", "combat"] as const;

/** In `teams` (four players only) A scores for A+C and B for B+D. */
const SCORING_MODES = ["players", "teams"] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];

const playerSchema = z.enum(BOARD_PLAYERS);
const idSchema = z.string().regex(/^[a-z0-9]{1,12}$/u);
const counterValueSchema = z.number().int().min(0).max(99);

const cardRefSchema = z
  .object({
    cardId: z.uuid(),
    printingId: z.uuid().optional(),
    name: z.string().min(1).max(200),
  })
  .strict();

const battlefieldIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_BATTLEFIELDS - 1);

const zoneRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("battlefield"), index: battlefieldIndexSchema }).strict(),
  z.object({ kind: z.literal("facedown"), index: battlefieldIndexSchema }).strict(),
  z.object({ kind: z.enum(PLAYER_ZONE_KINDS) }).strict(),
]);

const pieceSchema = z
  .object({
    id: idSchema,
    owner: playerSchema,
    zone: zoneRefSchema,
    kind: z.enum(PIECE_KINDS),
    card: cardRefSchema.nullable(),
    label: z.string().max(40).optional(),
    exhausted: z.boolean(),
    facedown: z.boolean(),
    keywords: z.array(z.string().min(1).max(40)).max(MAX_PIECE_KEYWORDS),
    damage: z.number().int().min(0).max(99),
    might: z.number().int().min(-99).max(99),
    buffs: z.number().int().min(0).max(MAX_PIECE_BUFFS),
    counter: z
      .object({ value: counterValueSchema, label: z.string().min(1).max(20).optional() })
      .strict()
      .optional(),
    highlight: z.boolean(),
  })
  .strict();

/** A spell names its card, an ability its source piece; a hypothetical entry has only a label. */
const chainEntrySchema = z
  .object({
    id: idSchema,
    owner: playerSchema,
    type: z.enum(CHAIN_ENTRY_TYPES),
    label: z.string().min(1).max(80).optional(),
    card: cardRefSchema.optional(),
    source: idSchema.optional(),
  })
  .strict();

const pieceEndSchema = z.object({ piece: idSchema }).strict();
const chainEndSchema = z.object({ chain: idSchema }).strict();

const arrowSchema = z
  .object({
    kind: z.enum(ARROW_KINDS),
    from: z.union([pieceEndSchema, chainEndSchema]),
    to: z.union([
      pieceEndSchema,
      chainEndSchema,
      z.object({ zone: zoneRefSchema, owner: playerSchema }).strict(),
    ]),
  })
  .strict();

const turnSchema = z
  .object({
    player: playerSchema.optional(),
    phase: z.enum(TURN_PHASES).optional(),
    state: z.enum(TURN_STATES).optional(),
    priority: playerSchema.optional(),
    focus: playerSchema.optional(),
  })
  .strict();

const playerStatsSchema = z
  .object({
    score: counterValueSchema.optional(),
    xp: counterValueSchema.optional(),
    energy: counterValueSchema.optional(),
    /** Keyed by domain slug. */
    power: z.record(z.string().regex(/^[a-z]{1,20}$/u), z.number().int().min(1).max(99)).optional(),
    deckCount: counterValueSchema.optional(),
  })
  .strict();

const battlefieldStateSchema = z
  .object({
    controller: playerSchema.nullable(),
    contested: z.boolean(),
    scoredBy: z.array(playerSchema).max(BOARD_PLAYERS.length),
    encounter: z.enum(BATTLEFIELD_ENCOUNTERS).nullable(),
  })
  .strict();

const stepSchema = z
  .object({
    caption: z.string().max(2000),
    pieces: z.array(pieceSchema).max(MAX_STEP_PIECES),
    chain: z.array(chainEntrySchema).max(MAX_CHAIN_ENTRIES),
    arrows: z.array(arrowSchema).max(20),
    turn: turnSchema,
    players: z.partialRecord(playerSchema, playerStatsSchema),
    /** Parallel to the document's battlefields. */
    battlefields: z.array(battlefieldStateSchema).max(MAX_BATTLEFIELDS),
  })
  .strict();

export const boardZoneVisibilitySchema = z
  .object({
    base: z.boolean(),
    legend: z.boolean(),
    champion: z.boolean(),
    runes: z.boolean(),
    hand: z.boolean(),
    trash: z.boolean(),
    banishment: z.boolean(),
    deck: z.boolean(),
    chain: z.boolean(),
    score: z.boolean(),
  })
  .strict();

export type BoardCardRef = z.infer<typeof cardRefSchema>;
export type BoardZoneRef = z.infer<typeof zoneRefSchema>;
export type BoardPiece = z.infer<typeof pieceSchema>;
export type BoardChainEntry = z.infer<typeof chainEntrySchema>;
export type BoardArrow = z.infer<typeof arrowSchema>;
export type BoardArrowEnd = BoardArrow["to"];
export type BoardTurn = z.infer<typeof turnSchema>;
export type BoardPlayerStats = z.infer<typeof playerStatsSchema>;
export type BoardBattlefieldState = z.infer<typeof battlefieldStateSchema>;
export type BoardStep = z.infer<typeof stepSchema>;
export type BoardZoneVisibility = z.infer<typeof boardZoneVisibilitySchema>;

interface DocumentShape {
  playerCount: number;
  scoring: ScoringMode;
  battlefields: unknown[];
}

function checkStep(
  doc: DocumentShape,
  step: BoardStep,
  issue: (path: (string | number)[], message: string) => void,
) {
  const players = new Set<BoardPlayer>(BOARD_PLAYERS.slice(0, doc.playerCount));
  const pieceOwners = new Map<string, BoardPlayer>();
  for (const [index, piece] of step.pieces.entries()) {
    const path = ["pieces", index];
    if (pieceOwners.has(piece.id)) {
      issue(path, "Duplicate piece id.");
    }
    pieceOwners.set(piece.id, piece.owner);
    if (!players.has(piece.owner)) {
      issue(path, "Owner is not in this game.");
    }
    const battlefield = zoneBattlefieldIndex(piece.zone);
    if (battlefield !== null && battlefield >= doc.battlefields.length) {
      issue(path, "Battlefield does not exist.");
    }
    if (new Set(piece.keywords).size !== piece.keywords.length) {
      issue(path, "Duplicate keyword.");
    }
  }
  const chainIds = new Set<string>();
  for (const [index, entry] of step.chain.entries()) {
    const path = ["chain", index];
    if (chainIds.has(entry.id)) {
      issue(path, "Duplicate chain entry id.");
    }
    chainIds.add(entry.id);
    if (!players.has(entry.owner)) {
      issue(path, "Owner is not in this game.");
    }
    if (entry.source !== undefined && !pieceOwners.has(entry.source)) {
      issue(path, "Chain entry source is a missing piece.");
    }
    if (entry.label === undefined && entry.card === undefined && entry.source === undefined) {
      issue(path, "Chain entry needs a label, a card or a source.");
    }
  }
  for (const [index, arrow] of step.arrows.entries()) {
    const path = ["arrows", index];
    const missing = [arrow.from, arrow.to].some(
      (end) =>
        ("piece" in end && !pieceOwners.has(end.piece)) ||
        ("chain" in end && !chainIds.has(end.chain)),
    );
    if (missing) {
      issue(path, "Arrow points at a missing piece or chain entry.");
    }
    if ("chain" in arrow.from && arrow.kind !== "target") {
      issue(path, "Arrows from the chain can only target.");
    }
    if (arrow.kind === "recall") {
      const owner = "piece" in arrow.from ? pieceOwners.get(arrow.from.piece) : undefined;
      if (!("zone" in arrow.to) || arrow.to.zone.kind !== "base" || arrow.to.owner !== owner) {
        issue(path, "A recall goes to its piece owner's base.");
      }
    }
  }
  const { turn } = step;
  if ([turn.player, turn.priority, turn.focus].some((p) => p !== undefined && !players.has(p))) {
    issue(["turn"], "Player is not in this game.");
  }
  for (const [player, stats] of Object.entries(step.players)) {
    if (!players.has(player as BoardPlayer)) {
      issue(["players", player], "Player is not in this game.");
    }
    if (
      doc.scoring === "teams" &&
      (player === "C" || player === "D") &&
      stats.score !== undefined
    ) {
      issue(["players", player], "Team scores are kept on A and B.");
    }
  }
  if (step.battlefields.length !== doc.battlefields.length) {
    issue(["battlefields"], "Battlefield state does not match the battlefields.");
  }
  for (const [index, state] of step.battlefields.entries()) {
    const named =
      state.controller === null ? state.scoredBy : [state.controller, ...state.scoredBy];
    if (named.some((player) => !players.has(player))) {
      issue(["battlefields", index], "Player is not in this game.");
    }
    if (new Set(state.scoredBy).size !== state.scoredBy.length) {
      issue(["battlefields", index], "Duplicate scorer.");
    }
  }
}

export const boardDocumentSchema = z
  .object({
    schemaVersion: z.literal(BOARD_STATE_SCHEMA_VERSION),
    playerCount: z.number().int().min(2).max(4),
    scoring: z.enum(SCORING_MODES),
    battlefields: z
      .array(z.object({ card: cardRefSchema.nullable() }).strict())
      .max(MAX_BATTLEFIELDS),
    zones: boardZoneVisibilitySchema,
    steps: z.array(stepSchema).min(1).max(MAX_BOARD_STEPS),
  })
  .strict()
  .superRefine((doc, ctx) => {
    if (doc.scoring === "teams" && doc.playerCount !== 4) {
      ctx.addIssue({ code: "custom", path: ["scoring"], message: "Teams need four players." });
    }
    for (const [stepIndex, step] of doc.steps.entries()) {
      checkStep(doc, step, (path, message) =>
        ctx.addIssue({ code: "custom", path: ["steps", stepIndex, ...path], message }),
      );
    }
  });

export type BoardDocument = z.infer<typeof boardDocumentSchema>;

/** The battlefield a zone belongs to: the battlefield itself or its facedown zone. */
export function zoneBattlefieldIndex(zone: BoardZoneRef): number | null {
  return zone.kind === "battlefield" || zone.kind === "facedown" ? zone.index : null;
}

export function shownBattlefields(document: BoardDocument): number[] {
  const used = new Set<number>();
  for (const step of document.steps) {
    for (const piece of step.pieces) {
      const index = zoneBattlefieldIndex(piece.zone);
      if (index !== null) {
        used.add(index);
      }
    }
    for (const arrow of step.arrows) {
      const index = "zone" in arrow.to ? zoneBattlefieldIndex(arrow.to.zone) : null;
      if (index !== null) {
        used.add(index);
      }
    }
    for (const [index, state] of step.battlefields.entries()) {
      if (
        state.controller !== null ||
        state.contested ||
        state.scoredBy.length > 0 ||
        state.encounter !== null
      ) {
        used.add(index);
      }
    }
  }
  const all = document.battlefields.map((_, index) => index);
  return used.size === 0 ? all : all.filter((index) => used.has(index));
}

export function sameZone(a: BoardZoneRef, b: BoardZoneRef): boolean {
  return a.kind === b.kind && zoneBattlefieldIndex(a) === zoneBattlefieldIndex(b);
}

export function isDeckZone(zone: BoardZoneRef): boolean {
  return zone.kind === "deck" || zone.kind === "runeDeck";
}

export function emptyBattlefieldState(): BoardBattlefieldState {
  return { controller: null, contested: false, scoredBy: [], encounter: null };
}

export function emptyBoardStep(battlefieldCount: number): BoardStep {
  return {
    caption: "",
    pieces: [],
    chain: [],
    arrows: [],
    turn: {},
    players: {},
    battlefields: Array.from({ length: battlefieldCount }, () => emptyBattlefieldState()),
  };
}

export function emptyBoardDocument(): BoardDocument {
  return {
    schemaVersion: BOARD_STATE_SCHEMA_VERSION,
    playerCount: 2,
    scoring: "players",
    battlefields: [{ card: null }, { card: null }],
    zones: {
      base: true,
      legend: true,
      champion: true,
      runes: true,
      hand: false,
      trash: false,
      banishment: false,
      deck: false,
      chain: false,
      score: false,
    },
    steps: [emptyBoardStep(2)],
  };
}

/** Null for an ability whose source piece has no card; callers fall back to the entry type. */
export function chainEntryName(
  entry: BoardChainEntry,
  pieces: readonly BoardPiece[],
): string | null {
  const source = pieces.find((piece) => piece.id === entry.source);
  return entry.label ?? entry.card?.name ?? source?.card?.name ?? null;
}

export function nextBoardId(prefix: string, used: Iterable<string>): string {
  const taken = new Set(used);
  let n = 1;
  while (taken.has(`${prefix}${n}`)) {
    n++;
  }
  return `${prefix}${n}`;
}

export type RuleRefKind = "core" | "tournament";

export interface RuleRef {
  kind: RuleRefKind;
  ruleNumber: string;
}

const RULE_NUMBER = String.raw`\d+(?:\.(?:\d+|[a-z]))*`;
const BOARD_ID = "[a-z0-9]{1,12}";

/** `[[460.3]]` and `[[466.1.a.2]]` are core rules, `[[t:460.3]]` a tournament rule. */
export const RULE_REF_PATTERN = new RegExp(
  String.raw`\[\[(?<tournament>t:)?(?<number>${RULE_NUMBER})\]\]`,
  "gu",
);

export function ruleRefFromMatch(match: RegExpMatchArray): RuleRef | undefined {
  const ruleNumber = match.groups?.number;
  if (ruleNumber === undefined) {
    return undefined;
  }
  return { kind: match.groups?.tournament === undefined ? "core" : "tournament", ruleNumber };
}

/** `[[card:p1]]` names a piece in the current step. */
export const CARD_REF_PATTERN = new RegExp(String.raw`\[\[card:(?<piece>${BOARD_ID})\]\]`, "gu");

export const CAPTION_REF_PATTERN = new RegExp(
  String.raw`\[\[(?:(?<tournament>t:)?(?<number>${RULE_NUMBER})|card:(?<piece>${BOARD_ID})|chain:(?<chain>${BOARD_ID}))\]\]`,
  "gu",
);

export type CaptionRef =
  | { kind: "rule"; ref: RuleRef }
  | { kind: "card"; pieceId: string }
  | { kind: "chain"; entryId: string };

export function captionRefFromMatch(match: RegExpMatchArray): CaptionRef | undefined {
  const pieceId = match.groups?.piece;
  if (pieceId !== undefined) {
    return { kind: "card", pieceId };
  }
  const entryId = match.groups?.chain;
  if (entryId !== undefined) {
    return { kind: "chain", entryId };
  }
  const ref = ruleRefFromMatch(match);
  return ref === undefined ? undefined : { kind: "rule", ref };
}

export function extractCardRefs(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(CARD_REF_PATTERN)) {
    const pieceId = match.groups?.piece;
    if (pieceId !== undefined) {
      seen.add(pieceId);
    }
  }
  return [...seen];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function upgradePiece(raw: unknown, version: number): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  if (version === 1) {
    const { stunned, buff, ...rest } = raw;
    return {
      ...rest,
      keywords: stunned === true ? ["Stun"] : [],
      might: typeof buff === "number" ? buff : 0,
      facedown: false,
      buffs: 0,
    };
  }
  return { ...raw, facedown: false, buffs: 0 };
}

/** v1 entries were free text with an optional card, v2 entries a card only; both become spells. */
function upgradeChain(raw: unknown[]): unknown[] {
  const entries: unknown[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) {
      continue;
    }
    const card = isRecord(entry.card) ? entry.card : undefined;
    const text = typeof entry.text === "string" ? entry.text.trim().slice(0, 80) : "";
    const label = text === "" || text === card?.name ? undefined : text;
    if (card === undefined && label === undefined) {
      continue;
    }
    entries.push({
      id: `c${entries.length + 1}`,
      owner: entry.owner,
      type: "spell",
      ...(label === undefined ? {} : { label }),
      ...(card === undefined ? {} : { card }),
    });
  }
  return entries;
}

function upgradeArrow(raw: unknown): unknown {
  if (!isRecord(raw) || typeof raw.from !== "string") {
    return raw;
  }
  return { ...raw, from: { piece: raw.from } };
}

function upgradeStep(raw: unknown, version: number, battlefieldCount: number): unknown {
  if (!isRecord(raw)) {
    return raw;
  }
  return {
    ...raw,
    pieces: Array.isArray(raw.pieces)
      ? raw.pieces.map((piece) => upgradePiece(piece, version))
      : raw.pieces,
    chain: Array.isArray(raw.chain) ? upgradeChain(raw.chain) : raw.chain,
    arrows: Array.isArray(raw.arrows) ? raw.arrows.map((arrow) => upgradeArrow(arrow)) : raw.arrows,
    turn: {},
    players: {},
    battlefields: Array.from({ length: battlefieldCount }, () => emptyBattlefieldState()),
  };
}

export function upgradeBoardDocument(raw: unknown): BoardDocument | null {
  if (!isRecord(raw)) {
    return null;
  }
  let candidate: unknown = raw;
  const version = raw.schemaVersion;
  if (version === 1 || version === 2) {
    const battlefieldCount = Array.isArray(raw.battlefields) ? raw.battlefields.length : 0;
    candidate = {
      ...raw,
      schemaVersion: BOARD_STATE_SCHEMA_VERSION,
      scoring: "players",
      zones: isRecord(raw.zones)
        ? { deck: false, ...raw.zones, banishment: false, score: false }
        : raw.zones,
      steps: Array.isArray(raw.steps)
        ? raw.steps.map((step) => upgradeStep(step, version, battlefieldCount))
        : raw.steps,
    };
  }
  const parsed = boardDocumentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Rule references in a caption, unique by kind and number, in order of first appearance. */
export function extractRuleRefs(text: string): RuleRef[] {
  const seen = new Set<string>();
  const refs: RuleRef[] = [];
  for (const match of text.matchAll(RULE_REF_PATTERN)) {
    const ref = ruleRefFromMatch(match);
    const key = ref ? `${ref.kind}:${ref.ruleNumber}` : "";
    if (ref && !seen.has(key)) {
      seen.add(key);
      refs.push(ref);
    }
  }
  return refs;
}

const PIECE_KIND_NAME: Record<PieceKind, string> = {
  unit: "Unit",
  spell: "Spell",
  gear: "Gear",
  rune: "Rune",
  legend: "Legend",
  token: "Token",
};

export function boardStateSummary(document: BoardDocument): string | null {
  const step = document.steps.at(-1);
  if (!step) {
    return null;
  }
  let text = "";
  let cursor = 0;
  for (const match of step.caption.matchAll(CAPTION_REF_PATTERN)) {
    const ref = captionRefFromMatch(match);
    text += step.caption.slice(cursor, match.index);
    cursor = match.index + match[0].length;
    if (ref?.kind === "rule") {
      text += `§ ${ref.ref.kind === "tournament" ? "T " : ""}${ref.ref.ruleNumber}`;
    } else if (ref?.kind === "card") {
      const piece = step.pieces.find((candidate) => candidate.id === ref.pieceId);
      text += piece ? (piece.card?.name ?? PIECE_KIND_NAME[piece.kind]) : "";
    } else if (ref?.kind === "chain") {
      const entry = step.chain.find((candidate) => candidate.id === ref.entryId);
      text += entry ? (chainEntryName(entry, step.pieces) ?? "") : "";
    }
  }
  text = (text + step.caption.slice(cursor)).replaceAll(/\s+/gu, " ").trim();
  return text === "" ? null : text;
}
