/**
 * Vstyle Cultural Rule Engine
 * Deterministic, source-grounded cultural compatibility engine
 *
 * Architecture:
 *   OUTFIT -> CULTURAL RULE ENGINE -> CULTURAL RESULT -> GEMINI EXPLANATION
 *
 * The same outfit + same approved rules will always return the exact same result.
 * Completely deterministic. No randomness. Zero Gemini dependency.
 */

import type {
  AdaptiveAdjustment,
  Garment,
  CultureCheckResult,
  CultureStatus,
  CultureRule,
  CultureSource,
  GeminiCultureContext,
  Outfit,
} from '../../types/domain.ts';
import { CultureRuleSchema } from '../validation/domainSchemas.ts';
import {
  getAdaptiveAdjustments,
  getAllSources,
  getApprovedGarments,
  getCultureRules,
} from '../dal/index.ts';
import { evaluateRule, type EvaluationContext } from './ruleEvaluators.ts';

export interface CultureCheckInput {
  garmentId: string;
  accessoryIds: string[];
  eventId?: string;
  primaryColor?: string;
  adaptiveNeedCode?: string;
}

/**
 * Normalizes input: handles both CultureCheckInput and complete Outfit objects
 */
function normalizeInput(input: CultureCheckInput | Outfit): CultureCheckInput {
  return {
    garmentId: input.garmentId,
    accessoryIds: input.accessoryIds || [],
    eventId: input.eventId,
    primaryColor: input.primaryColor,
    adaptiveNeedCode: input.adaptiveNeedCode,
  };
}

/**
 * Deterministic cultural evaluation for an outfit
 */
export interface CultureEngineData {
  garment?: Garment;
  rules: unknown[];
  sources: CultureSource[];
  adaptiveAdjustments: AdaptiveAdjustment[];
}

export function evaluateCultureWithData(
  input: CultureCheckInput,
  data: CultureEngineData,
): CultureCheckResult {
  const garment = data.garment;

  if (!garment || garment.status !== 'APPROVED' || !garment.verified) {
    return {
      status: 'WARNING',
      score: 40,
      ruleIds: [],
      reasons: ['Chưa có dữ liệu y phục đã được phê duyệt để đánh giá bản phối này.'],
      retainedCharacteristics: [],
      sourceIds: [],
      nonNegotiablesSatisfied: false,
    };
  }

  const validSourceIds = new Set(
    data.sources.filter((source) => source.verified && source.url !== null).map((source) => source.id),
  );
  const garmentSourceIds = garment.sourceIds.filter((id) => validSourceIds.has(id));
  if (garmentSourceIds.length === 0) {
    return {
      status: 'WARNING',
      score: 40,
      ruleIds: [],
      reasons: ['Chưa có nguồn đã xác minh cho dữ liệu y phục cần đánh giá.'],
      retainedCharacteristics: [],
      sourceIds: [],
      nonNegotiablesSatisfied: false,
    };
  }

  const approvedRules: CultureRule[] = [];
  for (const candidate of data.rules) {
    const parsed = CultureRuleSchema.safeParse(candidate);
    if (!parsed.success || parsed.data.status !== 'APPROVED' || parsed.data.condition.type === 'CUSTOM') {
      continue;
    }
    if (!parsed.data.sourceIds.some((id) => validSourceIds.has(id))) continue;
    approvedRules.push(parsed.data as CultureRule);
  }

  const adaptiveAdjustment = data.adaptiveAdjustments.find((adjustment) =>
    adjustment.validated &&
    adjustment.needCode === input.adaptiveNeedCode &&
    (adjustment.garmentId === 'ALL' || adjustment.garmentId === garment.id) &&
    validSourceIds.has(adjustment.sourceId),
  );

  const evalContext: EvaluationContext = {
    garment,
    accessoryIds: input.accessoryIds,
    eventId: input.eventId,
    primaryColor: input.primaryColor,
    adaptiveAdjustment,
  };

  let score = 100;
  let hasWarning = false;
  let hasConsider = false;

  const collectedRuleIds = new Set<string>();
  const collectedReasons = new Set<string>();
  const collectedRetainedCharacteristics = new Set(garment.characteristics);
  const collectedSourceIds = new Set(garmentSourceIds);

  for (const rule of approvedRules) {
    const evalResult = evaluateRule(rule, evalContext);

    if (evalResult.triggered) {
      collectedRuleIds.add(rule.id);
      evalResult.sourceIds.filter((id) => validSourceIds.has(id)).forEach((id) => collectedSourceIds.add(id));
      evalResult.retainedCharacteristics.forEach((item) => collectedRetainedCharacteristics.add(item));

      if (evalResult.severity === 'WARNING') {
        hasWarning = true;
        score -= evalResult.scoreDeduction;
      } else if (evalResult.severity === 'CONSIDER') {
        hasConsider = true;
        score -= evalResult.scoreDeduction;
      }

      if (evalResult.reason) collectedReasons.add(evalResult.reason);
    }
  }

  const status: CultureStatus = hasWarning ? 'WARNING' : hasConsider ? 'CONSIDER' : 'KEEP';

  return {
    status,
    score: Math.max(0, Math.min(100, Math.round(score))),
    ruleIds: [...collectedRuleIds],
    reasons: [...collectedReasons],
    retainedCharacteristics: [...collectedRetainedCharacteristics],
    sourceIds: [...collectedSourceIds],
    nonNegotiablesSatisfied: !hasWarning,
  };
}

export function checkCulture(rawInput: CultureCheckInput | Outfit): CultureCheckResult {
  const input = normalizeInput(rawInput);
  const garment = getApprovedGarments().find((item) => item.id === input.garmentId);

  return evaluateCultureWithData(input, {
    garment,
    rules: getCultureRules(),
    sources: getAllSources(),
    adaptiveAdjustments: getAdaptiveAdjustments(),
  });
}

/**
 * Formats a clean object ready to be passed to Gemini for editorial explanation.
 * Gemini may explain this result. Gemini may NOT change it.
 */
export function formatCultureForGemini(cultureResult: CultureCheckResult): GeminiCultureContext {
  const resultSnapshot: CultureCheckResult = {
    ...cultureResult,
    ruleIds: [...cultureResult.ruleIds],
    reasons: [...cultureResult.reasons],
    retainedCharacteristics: [...cultureResult.retainedCharacteristics],
    sourceIds: [...cultureResult.sourceIds],
  };

  return {
    cultureResult: resultSnapshot,
    ruleIds: [...resultSnapshot.ruleIds],
    reasons: [...resultSnapshot.reasons],
    retainedCharacteristics: [...resultSnapshot.retainedCharacteristics],
    sourceIds: [...resultSnapshot.sourceIds],
  };
}
