export const BOARD_REARM_QUIET_MS = 1000;
const BOARD_SURVEYS_TO_TRIGGER = 2;

export interface BoardTrigger {
  streak: number;
  armed: boolean;
  quietSince: number | null;
  readArtKeys: Set<string>;
}

export function boardTriggerStart(): BoardTrigger {
  return {
    streak: 0,
    armed: true,
    quietSince: null,
    readArtKeys: new Set(),
  };
}

export interface BoardSurveyGate {
  cardInGuide: boolean;
  settling: boolean;
  sweeping: boolean;
}

export function boardSurveyCounts(gate: BoardSurveyGate): boolean {
  return !gate.cardInGuide && !gate.settling && !gate.sweeping;
}

/** Records a survey; true when the scanner should read every card now. */
export function noteBoardSurvey(trigger: BoardTrigger, cards: number, now: number): boolean {
  if (cards >= 2) {
    trigger.quietSince = null;
    trigger.streak++;
    if (trigger.armed && trigger.streak >= BOARD_SURVEYS_TO_TRIGGER) {
      trigger.armed = false;
      trigger.streak = 0;
      return true;
    }
    return false;
  }
  trigger.streak = 0;
  if (cards === 0) {
    trigger.readArtKeys.clear();
  }
  if (!trigger.armed) {
    trigger.quietSince ??= now;
    if (now - trigger.quietSince >= BOARD_REARM_QUIET_MS) {
      trigger.armed = true;
      trigger.quietSince = null;
    }
  }
  return false;
}

export function freshBoardCards<T extends { artKey: string }>(
  trigger: BoardTrigger,
  cards: readonly T[],
): T[] {
  const fresh = cards.filter((card) => !trigger.readArtKeys.has(card.artKey));
  for (const card of cards) {
    trigger.readArtKeys.add(card.artKey);
  }
  return fresh;
}
