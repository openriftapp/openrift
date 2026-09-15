import { z } from "zod";

export const BOARD_STATE_SCHEMA_VERSION = 1;
export const BOARD_PLAYERS = ["A", "B", "C", "D"] as const;
export const MAX_BATTLEFIELDS = 3;
export const MAX_BOARD_STEPS = 20;
export const MAX_STEP_PIECES = 60;

export type BoardPlayer = (typeof BOARD_PLAYERS)[number];

export const PLAYER_ZONE_KINDS = ["base", "legend", "champion", "runes", "hand", "trash"] as const;
export type PlayerZoneKind = (typeof PLAYER_ZONE_KINDS)[number];

export const PIECE_KINDS = ["unit", "spell", "gear", "rune", "legend", "token"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

const playerSchema = z.enum(BOARD_PLAYERS);

const cardRefSchema = z
  .object({
    cardId: z.uuid(),
    printingId: z.uuid().optional(),
    name: z.string().min(1).max(200),
  })
  .strict();

const zoneRefSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("battlefield"),
      index: z
        .number()
        .int()
        .min(0)
        .max(MAX_BATTLEFIELDS - 1),
    })
    .strict(),
  z.object({ kind: z.enum(PLAYER_ZONE_KINDS) }).strict(),
]);

const pieceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]{1,12}$/u),
    owner: playerSchema,
    zone: zoneRefSchema,
    kind: z.enum(PIECE_KINDS),
    card: cardRefSchema.nullable(),
    label: z.string().max(40).optional(),
    exhausted: z.boolean(),
    stunned: z.boolean(),
    damage: z.number().int().min(0).max(99),
    buff: z.number().int().min(0).max(99),
    highlight: z.boolean(),
  })
  .strict();

const chainEntrySchema = z
  .object({
    owner: playerSchema,
    text: z.string().min(1).max(200),
    card: cardRefSchema.nullable(),
  })
  .strict();

const arrowSchema = z
  .object({
    kind: z.enum(["move", "target"]),
    from: z.string(),
    to: z.union([
      z.object({ piece: z.string() }).strict(),
      z.object({ zone: zoneRefSchema, owner: playerSchema }).strict(),
    ]),
  })
  .strict();

const stepSchema = z
  .object({
    caption: z.string().max(2000),
    pieces: z.array(pieceSchema).max(MAX_STEP_PIECES),
    chain: z.array(chainEntrySchema).max(20),
    arrows: z.array(arrowSchema).max(20),
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
    chain: z.boolean(),
  })
  .strict();

export const boardDocumentSchema = z
  .object({
    schemaVersion: z.literal(BOARD_STATE_SCHEMA_VERSION),
    playerCount: z.number().int().min(2).max(4),
    battlefields: z
      .array(z.object({ card: cardRefSchema.nullable() }).strict())
      .max(MAX_BATTLEFIELDS),
    zones: boardZoneVisibilitySchema,
    steps: z.array(stepSchema).min(1).max(MAX_BOARD_STEPS),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const players = new Set(BOARD_PLAYERS.slice(0, doc.playerCount));
    for (const [stepIndex, step] of doc.steps.entries()) {
      const ids = new Set<string>();
      for (const [pieceIndex, piece] of step.pieces.entries()) {
        const path = ["steps", stepIndex, "pieces", pieceIndex];
        if (ids.has(piece.id)) {
          ctx.addIssue({ code: "custom", path, message: "Duplicate piece id." });
        }
        ids.add(piece.id);
        if (!players.has(piece.owner)) {
          ctx.addIssue({ code: "custom", path, message: "Owner is not in this game." });
        }
        if (piece.zone.kind === "battlefield" && piece.zone.index >= doc.battlefields.length) {
          ctx.addIssue({ code: "custom", path, message: "Battlefield does not exist." });
        }
      }
      for (const [arrowIndex, arrow] of step.arrows.entries()) {
        const path = ["steps", stepIndex, "arrows", arrowIndex];
        const target = "piece" in arrow.to ? arrow.to.piece : null;
        if (!ids.has(arrow.from) || (target !== null && !ids.has(target))) {
          ctx.addIssue({ code: "custom", path, message: "Arrow points at a missing piece." });
        }
      }
    }
  });

export type BoardCardRef = z.infer<typeof cardRefSchema>;
export type BoardZoneRef = z.infer<typeof zoneRefSchema>;
export type BoardPiece = z.infer<typeof pieceSchema>;
export type BoardChainEntry = z.infer<typeof chainEntrySchema>;
export type BoardArrow = z.infer<typeof arrowSchema>;
export type BoardStep = z.infer<typeof stepSchema>;
export type BoardZoneVisibility = z.infer<typeof boardZoneVisibilitySchema>;
export type BoardDocument = z.infer<typeof boardDocumentSchema>;

export function emptyBoardDocument(): BoardDocument {
  return {
    schemaVersion: BOARD_STATE_SCHEMA_VERSION,
    playerCount: 2,
    battlefields: [{ card: null }],
    zones: {
      base: true,
      legend: false,
      champion: false,
      runes: false,
      hand: false,
      trash: false,
      chain: false,
    },
    steps: [{ caption: "", pieces: [], chain: [], arrows: [] }],
  };
}

export type RuleRefKind = "core" | "tournament";

export interface RuleRef {
  kind: RuleRefKind;
  ruleNumber: string;
}

/** `[[460.3]]` is a core rule, `[[t:460.3]]` a tournament rule. */
export const RULE_REF_PATTERN = /\[\[(?<tournament>t:)?(?<number>\d+(?:\.\d+)*)\]\]/gu;

export function ruleRefFromMatch(match: RegExpMatchArray): RuleRef | undefined {
  const ruleNumber = match.groups?.number;
  if (ruleNumber === undefined) {
    return undefined;
  }
  return { kind: match.groups?.tournament === undefined ? "core" : "tournament", ruleNumber };
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
