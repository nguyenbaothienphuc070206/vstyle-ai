import { AdaptiveRule, Source } from '../../types/fashion';
import { getAdaptiveAdjustments, getAdaptiveAdjustmentByNeed, getSourceById, getAllSources } from '../dal';

export const adaptiveRulesList: AdaptiveRule[] = getAdaptiveAdjustments();
export const sourcesList: Source[] = getAllSources();

export interface AdaptiveCheckResult {
  hasAdaptiveNeed: boolean;
  needCode?: string;
  needName?: string;
  validated: boolean;
  adjustment?: string;
  reason?: string;
  tailoringSpecs?: AdaptiveRule['tailoringSpecs'];
  source?: Source;
  message: string;
}

export function checkAdaptive(needCode?: string, garmentId?: string): AdaptiveCheckResult {
  if (!needCode || needCode === 'NONE') {
    return {
      hasAdaptiveNeed: false,
      validated: true,
      message: 'Không áp dụng thông số thích ứng cá nhân.',
    };
  }

  // Look for exact match or generic "ALL" match using DAL
  const rule = getAdaptiveAdjustmentByNeed(needCode, garmentId);

  if (!rule || !rule.validated) {
    return {
      hasAdaptiveNeed: true,
      needCode,
      validated: false,
      message: 'Vstyle chưa có dữ liệu thích ứng đã được xác thực cho trường hợp này.',
    };
  }

  const source = getSourceById(rule.sourceId);

  return {
    hasAdaptiveNeed: true,
    needCode: rule.needCode,
    needName: rule.needName,
    validated: true,
    adjustment: rule.adjustment,
    reason: rule.reason,
    tailoringSpecs: rule.tailoringSpecs,
    source,
    message: 'Đã áp dụng quy chuẩn may đo thích ứng được xác thực bởi Vstyle Inclusive Fashion Council.',
  };
}
