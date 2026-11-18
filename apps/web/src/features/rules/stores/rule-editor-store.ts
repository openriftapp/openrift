import type { ListKind } from "@openrift/shared/types/api/list";
import type {
  ListRule,
  ListRuleCombine,
  RuleQuantity,
  TradeKeepFirst,
  TradeKeepPer,
} from "@openrift/shared/types/list-rule";
import type { Marketplace } from "@openrift/shared/types/pricing";
import type { CardFilters } from "@openrift/shared/types/search";
import { create } from "zustand";

import type { DraftRule } from "@/features/rules/lib/rule-draft";
import { draftFromRule, emptyDraft, serializeRules } from "@/features/rules/lib/rule-draft";

export interface RuleEditorState {
  rules: DraftRule[];
  ruleKeys: string[];
  ruleCombine: ListRuleCombine | null;
  /** The stored rules version the draft was loaded from; a save sends it back. */
  rulesVersion: number;

  load: (rules: ListRule[], ruleCombine?: ListRuleCombine | null, rulesVersion?: number) => void;
  /** Moves the draft onto a newer stored version without touching it. */
  rebase: (rulesVersion: number) => void;
  setRuleCombine: (ruleCombine: ListRuleCombine | null) => void;
  addRule: (languages?: string[]) => void;
  addDrafts: (drafts: DraftRule[]) => void;
  removeRule: (index: number) => void;
  setFilter: (index: number, filter: CardFilters) => void;
  setPriceMarketplace: (index: number, priceMarketplace: Marketplace | null) => void;
  setQuantity: (index: number, quantity: RuleQuantity) => void;
  setKeepPerCard: (index: number, keepPerCard: RuleQuantity) => void;
  setKeepPer: (index: number, keepPer: TradeKeepPer) => void;
  setKeepFirst: (index: number, keepFirst: TradeKeepFirst) => void;
  setNetOwned: (index: number, netOwned: boolean) => void;
  setCountSpecialVersions: (index: number, countSpecialVersions: boolean) => void;
  setCollectionScope: (index: number, included: string[], excluded: string[]) => void;
  toggleExcludeId: (index: number, id: string) => void;
  toggleKeepCopyId: (index: number, copyId: string) => void;
  reset: () => void;
  buildRules: (kind: ListKind) => ListRule[];
}

function patchRule(
  rules: DraftRule[],
  index: number,
  update: (rule: DraftRule) => DraftRule,
): DraftRule[] {
  return rules.map((rule, i) => (i === index ? update(rule) : rule));
}

let nextRuleKey = 0;
function newRuleKeys(count: number): string[] {
  return Array.from({ length: count }, () => `rule-${nextRuleKey++}`);
}

export const useRuleEditorStore = create<RuleEditorState>()((set, get) => ({
  rules: [],
  ruleKeys: [],
  ruleCombine: null,
  rulesVersion: 0,

  load: (rules, ruleCombine = null, rulesVersion = 0) =>
    set({
      rules: rules.map((rule) => draftFromRule(rule)),
      ruleKeys: newRuleKeys(rules.length),
      ruleCombine,
      rulesVersion,
    }),

  rebase: (rulesVersion) => set({ rulesVersion }),

  setRuleCombine: (ruleCombine) => set({ ruleCombine }),

  addRule: (languages) =>
    set((state) => ({
      rules: [...state.rules, emptyDraft(languages)],
      ruleKeys: [...state.ruleKeys, ...newRuleKeys(1)],
    })),

  addDrafts: (drafts) =>
    set((state) => ({
      rules: [...state.rules, ...drafts],
      ruleKeys: [...state.ruleKeys, ...newRuleKeys(drafts.length)],
    })),

  removeRule: (index) =>
    set((state) => ({
      rules: state.rules.filter((_, i) => i !== index),
      ruleKeys: state.ruleKeys.filter((_, i) => i !== index),
    })),

  setFilter: (index, filter) =>
    set((state) => ({ rules: patchRule(state.rules, index, (rule) => ({ ...rule, filter })) })),

  setPriceMarketplace: (index, priceMarketplace) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, priceMarketplace })),
    })),

  setQuantity: (index, quantity) =>
    set((state) => ({ rules: patchRule(state.rules, index, (rule) => ({ ...rule, quantity })) })),

  setKeepPerCard: (index, keepPerCard) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, keepPerCard })),
    })),

  setKeepPer: (index, keepPer) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, keepPer })),
    })),

  setKeepFirst: (index, keepFirst) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, keepFirst })),
    })),

  setNetOwned: (index, netOwned) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, netOwned })),
    })),

  setCountSpecialVersions: (index, countSpecialVersions) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({ ...rule, countSpecialVersions })),
    })),

  setCollectionScope: (index, included, excluded) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({
        ...rule,
        collectionIds: included.length === 0 ? null : included,
        collectionIdsExclude: excluded,
      })),
    })),

  toggleExcludeId: (index, id) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({
        ...rule,
        excludeIds: rule.excludeIds.includes(id)
          ? rule.excludeIds.filter((existing) => existing !== id)
          : [...rule.excludeIds, id],
      })),
    })),

  toggleKeepCopyId: (index, copyId) =>
    set((state) => ({
      rules: patchRule(state.rules, index, (rule) => ({
        ...rule,
        keepCopyIds: rule.keepCopyIds.includes(copyId)
          ? rule.keepCopyIds.filter((existing) => existing !== copyId)
          : [...rule.keepCopyIds, copyId],
      })),
    })),

  reset: () => set({ rules: [], ruleKeys: [], ruleCombine: null, rulesVersion: 0 }),

  buildRules: (kind) => serializeRules(get().rules, kind),
}));
