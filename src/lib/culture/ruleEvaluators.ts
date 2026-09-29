/**
 * Vstyle Cultural Rule Evaluators
 * Modular, deterministic evaluators for cultural compatibility conditions
 */

import type { AdaptiveAdjustment, Garment, CultureRule, RuleSeverity } from '../../types/domain.ts';

export interface EvaluationContext {
  garment: Garment;
  accessoryIds: string[];
  eventId?: string;
  primaryColor?: string;
  adaptiveAdjustment?: AdaptiveAdjustment;
}

export interface RuleEvaluationResult {
  triggered: boolean;
  ruleId: string;
  severity: RuleSeverity;
  reason?: string;
  scoreDeduction: number;
  retainedCharacteristics: string[];
  sourceIds: string[];
}

/**
 * Checks if targetGarments criteria applies to the current garment
 */
function isGarmentTargeted(targetGarments: string[] | undefined, garmentId: string): boolean {
  if (!targetGarments || targetGarments.length === 0) return true;
  if (targetGarments.includes('ALL')) return true;
  return targetGarments.includes(garmentId);
}

/**
 * Checks if targetEvents criteria applies to the current event
 */
function isEventTargeted(targetEvents: string[] | undefined, eventId: string | undefined): boolean {
  if (!targetEvents || targetEvents.length === 0) return true;
  if (!eventId) return false;
  return targetEvents.includes(eventId);
}

/**
 * 1. Evaluator for Preserved Cultural Structures (KEEP)
 */
export function evaluatePreservedStructure(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (!isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id)) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  return {
    triggered: true,
    ruleId: rule.id,
    severity: 'KEEP',
    reason: rule.reason,
    scoreDeduction: 0,
    retainedCharacteristics: [...ctx.garment.characteristics],
    sourceIds: [...rule.sourceIds],
  };
}

/**
 * 2. Evaluator for Mandatory Accessories on Specific Events (CONSIDER/WARNING)
 */
export function evaluateRequiredAccessoryOnEvent(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (
    !isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id) ||
    !isEventTargeted(rule.condition.targetEvents, ctx.eventId)
  ) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  const requiredIds = rule.condition.requiredAccessoryIds || [];
  const hasRequired = requiredIds.some((id) => ctx.accessoryIds.includes(id));

  if (!hasRequired) {
    return {
      triggered: true,
      ruleId: rule.id,
      severity: rule.severity,
      reason: rule.reason,
      scoreDeduction: 12,
      retainedCharacteristics: [],
      sourceIds: [...rule.sourceIds],
    };
  }

  return {
    triggered: true,
    ruleId: rule.id,
    severity: 'KEEP',
    reason: undefined,
    scoreDeduction: 0,
    retainedCharacteristics: [...ctx.garment.characteristics],
    sourceIds: [...rule.sourceIds],
  };
}

/**
 * 3. Evaluator for Always-Required Accessories (e.g. Yếm for Tứ Thân) (WARNING)
 */
export function evaluateRequiredAccessoryAlways(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (!isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id)) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  const requiredIds = rule.condition.requiredAccessoryIds || [];
  const hasRequired = requiredIds.some((id) => ctx.accessoryIds.includes(id));

  if (!hasRequired) {
    return {
      triggered: true,
      ruleId: rule.id,
      severity: 'WARNING',
      reason: rule.reason,
      scoreDeduction: 25,
      retainedCharacteristics: [],
      sourceIds: [...rule.sourceIds],
    };
  }

  return {
    triggered: true,
    ruleId: rule.id,
    severity: 'KEEP',
    reason: undefined,
    scoreDeduction: 0,
    retainedCharacteristics: [...ctx.garment.characteristics],
    sourceIds: [...rule.sourceIds],
  };
}

/**
 * 4. Evaluator for Event Color Contexts (CONSIDER)
 */
export function evaluateForbiddenColorOnEvent(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (
    !isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id) ||
    !isEventTargeted(rule.condition.targetEvents, ctx.eventId) ||
    !ctx.primaryColor
  ) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  const forbiddenColors = (rule.condition.forbiddenColors || []).map((c) => c.toLowerCase());
  const isForbidden = forbiddenColors.includes(ctx.primaryColor.toLowerCase());

  if (isForbidden) {
    return {
      triggered: true,
      ruleId: rule.id,
      severity: rule.severity,
      reason: rule.reason,
      scoreDeduction: 15,
      retainedCharacteristics: [],
      sourceIds: [...rule.sourceIds],
    };
  }

  return {
    triggered: false,
    ruleId: rule.id,
    severity: rule.severity,
    scoreDeduction: 0,
    retainedCharacteristics: [],
    sourceIds: [],
  };
}

/**
 * 5. Evaluator for Remix Accessories Incompatibility on High Formal Events (CONSIDER)
 */
export function evaluateIncompatibleAccessoryOnEvent(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (
    !isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id) ||
    !isEventTargeted(rule.condition.targetEvents, ctx.eventId)
  ) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  const incompatibleList = rule.condition.incompatibleAccessories || [];
  const foundIncompatible = incompatibleList.some((id) => ctx.accessoryIds.includes(id));

  if (foundIncompatible) {
    return {
      triggered: true,
      ruleId: rule.id,
      severity: rule.severity,
      reason: rule.reason,
      scoreDeduction: 10,
      retainedCharacteristics: [],
      sourceIds: [...rule.sourceIds],
    };
  }

  return {
    triggered: false,
    ruleId: rule.id,
    severity: 'KEEP',
    scoreDeduction: 0,
    retainedCharacteristics: [],
    sourceIds: [],
  };
}

/**
 * 6. Evaluator for Adaptive Preservation (KEEP)
 */
export function evaluateAdaptivePreservation(
  rule: CultureRule,
  ctx: EvaluationContext
): RuleEvaluationResult {
  if (!ctx.adaptiveAdjustment || !isGarmentTargeted(rule.condition.targetGarments, ctx.garment.id)) {
    return {
      triggered: false,
      ruleId: rule.id,
      severity: 'KEEP',
      scoreDeduction: 0,
      retainedCharacteristics: [],
      sourceIds: [],
    };
  }

  return {
    triggered: true,
    ruleId: rule.id,
    severity: 'KEEP',
    reason: rule.reason,
    scoreDeduction: 0,
    retainedCharacteristics: [...ctx.garment.characteristics],
    sourceIds: [...rule.sourceIds],
  };
}

/**
 * Master dispatcher for evaluating a single data-driven rule
 */
export function evaluateRule(rule: CultureRule, ctx: EvaluationContext): RuleEvaluationResult {
  switch (rule.condition.type) {
    case 'PRESERVED_STRUCTURE':
      return evaluatePreservedStructure(rule, ctx);
    case 'REQUIRE_ACCESSORY_ON_EVENT':
      return evaluateRequiredAccessoryOnEvent(rule, ctx);
    case 'REQUIRE_ACCESSORY_ALWAYS':
      return evaluateRequiredAccessoryAlways(rule, ctx);
    case 'FORBID_COLOR_ON_EVENT':
      return evaluateForbiddenColorOnEvent(rule, ctx);
    case 'INCOMPATIBLE_ACCESSORY_ON_EVENT':
      return evaluateIncompatibleAccessoryOnEvent(rule, ctx);
    case 'ADAPTIVE_PRESERVATION':
      return evaluateAdaptivePreservation(rule, ctx);
    default:
      return {
        triggered: false,
        ruleId: rule.id,
        severity: 'KEEP',
        scoreDeduction: 0,
        retainedCharacteristics: [],
        sourceIds: [],
      };
  }
}
