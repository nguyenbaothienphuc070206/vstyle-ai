import type {
  Accessory,
  FunctionalNeedCode,
  Garment,
  GarmentCategory,
  StyleScoreResult,
  StyleTag,
  EventItem,
} from '../../types/fashion.ts';
import { checkCulture } from '../culture/ruleEngine.ts';
import {
  getAdaptiveNeeds,
  getApprovedAccessories,
  getApprovedGarments,
  getApprovedSources,
  getCharacterById,
  getEvents,
  getEventById,
  getValidatedAdaptiveAdjustments,
  getWeatherContextById,
} from '../dal/index.ts';

export const garmentsList: Garment[] = getApprovedGarments();
export const eventsList: EventItem[] = getEvents();
export const accessoriesList: Accessory[] = getApprovedAccessories();

export interface RecommendationParams {
  eventId: string;
  weatherId?: string;
  styleVibe?: string;
  adaptiveNeedCode?: string;
  genderPreference?: string;
}

export interface RecommendedCandidate {
  garment: Garment;
  primaryColor: string;
  pantColor: string;
  recommendedAccessories: Accessory[];
  chuanScore: number;
  chatScore: number;
  totalScore: number;
  matchReasons: string[];
}

export const RECOMMENDATION_WEIGHTS = {
  event: 20,
  garment: 10,
  style: 15,
  color: 15,
  accessory: 10,
  weather: 10,
  adaptive: 10,
  culture: 10,
} as const;

export interface RecommendationContext {
  eventId: string;
  location?: string;
  weatherId?: string;
  garmentPreferences?: {
    preferredGarmentIds?: string[];
    preferredCategories?: GarmentCategory[];
    excludedGarmentIds?: string[];
  };
  style?: StyleTag;
  colorPreferences?: string[];
  accessoryIds?: string[];
  characterId?: string;
  adaptiveNeedCode?: FunctionalNeedCode | 'NONE';
  adaptiveNeedCodes?: FunctionalNeedCode[];
  limit?: number;
}

export interface DeterministicRecommendation {
  outfitId: string;
  garmentId: string;
  accessoryIds: string[];
  color: string;
  style: StyleTag;
  score: number;
  scoreBreakdown: Record<keyof typeof RECOMMENDATION_WEIGHTS, number>;
  reasons: string[];
  adaptiveAdjustmentIds: string[];
  cultureRuleIds: string[];
  sourceIds: string[];
  eventId: string;
  location?: string;
  weatherId?: string;
  characterId?: string;
  cultureStatus: 'KEEP' | 'CONSIDER';
}

const DEFAULT_RECOMMENDATION_LIMIT = 5;

const STYLE_TAG_LABELS: Record<StyleTag, string> = {
  TRUYEN_THONG: 'truyền thống',
  LE_NGHI: 'lễ nghi',
  CUNG_DINH: 'cung đình',
  DAN_GIAN: 'dân gian',
  TOI_GIAN: 'tối giản',
  REMIX_GEN_Z: 'Remix Gen Z',
  SANG_TRONG: 'sang trọng',
  THANH_LICH: 'thanh lịch',
  NANG_DONG: 'năng động',
  HOA_NHAP: 'hòa nhập',
  CO_DIEN: 'cổ điển',
};

function styleTagLabel(tag: StyleTag): string {
  return STYLE_TAG_LABELS[tag] ?? tag;
}
const MAX_RECOMMENDATION_LIMIT = 12;
const MAX_ACCESSORY_SETS_PER_GARMENT = 24;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isCompatibleAccessory(accessory: Accessory, garment: Garment, eventId: string): boolean {
  return accessory.status === 'APPROVED' &&
    accessory.verified &&
    accessory.compatibleGarmentIds.includes(garment.id) &&
    garment.compatibleAccessoryIds.includes(accessory.id) &&
    (!accessory.compatibleEventIds.length || accessory.compatibleEventIds.includes(eventId));
}

function generateAccessorySets(
  accessories: Accessory[],
  preferredAccessoryIds: string[],
): Accessory[][] {
  const sets = new Map<string, Accessory[]>();
  const addSet = (items: Accessory[]) => {
    const ordered = [...new Map(items.map((item) => [item.id, item])).values()]
      .sort((left, right) => compareText(left.id, right.id));
    const key = ordered.map((item) => item.id).join('|');
    if (!sets.has(key)) sets.set(key, ordered);
  };

  addSet([]);
  const preferred = accessories.filter((item) => preferredAccessoryIds.includes(item.id));
  if (preferred.length) addSet(preferred);
  accessories.forEach((item) => addSet([item]));

  for (let left = 0; left < accessories.length; left++) {
    for (let right = left + 1; right < accessories.length; right++) {
      addSet([accessories[left], accessories[right]]);
      if (sets.size >= MAX_ACCESSORY_SETS_PER_GARMENT) {
        return [...sets.values()];
      }
    }
  }

  return [...sets.values()];
}

function preferredColorMatches(colorName: string, colorHex: string, preferences: string[]): boolean {
  return preferences.some((preference) =>
    preference.toLowerCase() === colorName.toLowerCase() ||
    preference.toLowerCase() === colorHex.toLowerCase(),
  );
}

function chooseStyle(garment: Garment, event: EventItem, preference?: StyleTag): StyleTag {
  if (preference && garment.styleTags.includes(preference)) return preference;
  return garment.styleTags.find((tag) => event.recommendedStyleTags.includes(tag)) ?? garment.styleTags[0];
}

function scoreCandidate(
  factors: DeterministicRecommendation['scoreBreakdown'],
): number {
  const weightedScore = (Object.keys(RECOMMENDATION_WEIGHTS) as Array<keyof typeof RECOMMENDATION_WEIGHTS>)
    .reduce((total, factor) => total + factors[factor] * RECOMMENDATION_WEIGHTS[factor], 0) / 100;
  return Math.max(0, Math.min(100, Math.round(weightedScore)));
}

function selectDiverseCandidates(
  candidates: DeterministicRecommendation[],
  limit: number,
): DeterministicRecommendation[] {
  const ranked = [...candidates].sort((left, right) =>
    right.score - left.score || compareText(left.outfitId, right.outfitId),
  );
  const selected: DeterministicRecommendation[] = [];
  const selectedIds = new Set<string>();
  const selectedGarments = new Set<string>();

  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (selectedGarments.has(candidate.garmentId)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.outfitId);
    selectedGarments.add(candidate.garmentId);
  }

  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.outfitId)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.outfitId);
  }

  return selected.sort((left, right) =>
    right.score - left.score || compareText(left.outfitId, right.outfitId),
  );
}

/** Local fallback. It uses only approved knowledge-base records and deterministic scoring. */
export function getDeterministicRecommendations(
  context: RecommendationContext,
): DeterministicRecommendation[] {
  const event = getEventById(context.eventId);
  if (!event) return [];

  const weather = context.weatherId ? getWeatherContextById(context.weatherId) : undefined;
  if (context.weatherId && !weather) return [];

  if (context.characterId && !getCharacterById(context.characterId)) return [];

  const adaptiveNeedCodes = [...new Set([
    ...(context.adaptiveNeedCodes ?? []),
    ...(context.adaptiveNeedCode && context.adaptiveNeedCode !== 'NONE' ? [context.adaptiveNeedCode] : []),
  ])];
  const adaptiveNeeds = getAdaptiveNeeds();
  if (adaptiveNeedCodes.some((code) => !adaptiveNeeds.some((need) => need.code === code))) {
    return [];
  }

  const approvedSourceIds = new Set(getApprovedSources().map((source) => source.id));
  const adjustments = getValidatedAdaptiveAdjustments().filter((adjustment) =>
    approvedSourceIds.has(adjustment.sourceId),
  );
  const approvedAccessories = getApprovedAccessories().filter((accessory) =>
    accessory.verified && accessory.sourceIds.some((sourceId) => approvedSourceIds.has(sourceId)),
  );
  const excludedGarmentIds = new Set(context.garmentPreferences?.excludedGarmentIds ?? []);
  const preferredGarmentIds = context.garmentPreferences?.preferredGarmentIds ?? [];
  const preferredCategories = context.garmentPreferences?.preferredCategories ?? [];
  const preferredAccessoryIds = context.accessoryIds ?? [];
  const colorPreferences = context.colorPreferences ?? [];
  const candidates: DeterministicRecommendation[] = [];

  for (const garment of getApprovedGarments()) {
    if (excludedGarmentIds.has(garment.id)) continue;

    const eventCompatible = event.recommendedGarments?.includes(garment.id) ||
      (garment.occasions ?? garment.occasion ?? []).includes(event.id);
    if (!eventCompatible) continue;

    const matchingAdjustments = adaptiveNeedCodes.flatMap((needCode) => {
      const matches = adjustments.filter((adjustment) =>
        adjustment.needCode === needCode &&
        (adjustment.garmentId === garment.id || adjustment.garmentId === 'ALL'),
      ).sort((left, right) => {
        const leftSpecific = left.garmentId === garment.id ? 0 : 1;
        const rightSpecific = right.garmentId === garment.id ? 0 : 1;
        return leftSpecific - rightSpecific || compareText(left.id, right.id);
      });
      return matches[0] ? [matches[0]] : [];
    });
    if (matchingAdjustments.length !== adaptiveNeedCodes.length) continue;

    const adjustment = matchingAdjustments[0];
    const compatibleAccessories = approvedAccessories
      .filter((accessory) => isCompatibleAccessory(accessory, garment, event.id))
      .sort((left, right) => compareText(left.id, right.id));
    const accessorySets = generateAccessorySets(compatibleAccessories, preferredAccessoryIds);
    const colors = garment.baseColors.filter((color) => color.hex);
    if (colors.length === 0) continue;

    for (const color of colors) {
      const colorMatch = preferredColorMatches(color.name, color.hex, colorPreferences);
      const resolvedStyle = chooseStyle(garment, event, context.style);
      const styleMatch = !context.style || garment.styleTags.includes(context.style);
      const garmentPreferenceMatch =
        preferredGarmentIds.includes(garment.id) || preferredCategories.includes(garment.category);
      const eventScore = event.recommendedGarments?.includes(garment.id) ? 100 : 85;
      const garmentScore = preferredGarmentIds.length || preferredCategories.length
        ? garmentPreferenceMatch ? 100 : 35
        : 75;
      const styleScore = context.style ? styleMatch ? 100 : 25 : 75;
      const colorScore = colorPreferences.length ? colorMatch ? 100 : 25 : 75;
      const weatherScore = !weather ? 70 :
        weather.suggestedGarments.includes(garment.id) ? 100 : 35;

      for (const accessorySet of accessorySets) {
        const accessoryIds = accessorySet.map((accessory) => accessory.id);
        const preferredAccessoryCount = preferredAccessoryIds.filter((id) => accessoryIds.includes(id)).length;
        const accessoryScore = preferredAccessoryIds.length
          ? preferredAccessoryCount === preferredAccessoryIds.length
            ? 100
            : preferredAccessoryCount > 0
              ? Math.round(60 + 40 * preferredAccessoryCount / preferredAccessoryIds.length)
              : 25
          : accessoryIds.length >= 2 ? 90 : accessoryIds.length === 1 ? 80 : 60;

        const culture = checkCulture({
          garmentId: garment.id,
          accessoryIds,
          eventId: event.id,
          primaryColor: color.hex,
          adaptiveNeedCode: adaptiveNeedCodes[0],
        });
        if (culture.status === 'WARNING') continue;

        const factors: DeterministicRecommendation['scoreBreakdown'] = {
          event: eventScore,
          garment: garmentScore,
          style: styleScore,
          color: colorScore,
          accessory: accessoryScore,
          weather: weatherScore,
          adaptive: 100,
          culture: culture.status === 'KEEP' ? 100 : 70,
        };
        const adjustmentIds = matchingAdjustments.map((item) => item.id);
        const outfitId = [
          'outfit',
          garment.id,
          color.hex.toLowerCase().replace('#', ''),
          accessoryIds.join('+') || 'no-accessory',
          resolvedStyle,
          adjustmentIds.join('+') || 'standard',
        ].join('-');
        const reasons = [
          event.recommendedGarments?.includes(garment.id)
            ? `Phù hợp với sự kiện ${event.name}.`
            : `Dữ liệu dịp mặc có ghi nhận ${event.name}.`,
          context.style
            ? styleMatch ? `Hợp phong cách ${styleTagLabel(context.style)} bạn chọn.` : `Dùng phong cách ${styleTagLabel(resolvedStyle)}; phong cách ưu tiên chưa có trong dữ liệu y phục này.`
            : `Dùng phong cách tương thích ${styleTagLabel(resolvedStyle)}.`,
          colorMatch ? `Khớp màu ưu tiên ${color.name}.` : `Dùng màu ${color.name} trong dữ liệu y phục.`,
          preferredAccessoryCount
            ? `Có ${preferredAccessoryCount} phụ kiện ưu tiên tương thích.`
            : accessoryIds.length ? 'Phụ kiện đã được phê duyệt và tương thích với y phục, sự kiện.' : 'Không cần phụ kiện tương thích cho bản phối này.',
          weather
            ? weatherScore === 100 ? `Y phục được gợi ý cho ${weather.name}.` : `Mức phù hợp thời tiết thấp hơn với ${weather.name}.`
            : 'Chưa cung cấp ưu tiên thời tiết.',
          adjustment
            ? `Áp dụng điều chỉnh thích ứng đã xác thực (${adjustmentIds.join(', ')}).`
            : 'Không yêu cầu điều chỉnh thích ứng.',
          ...culture.reasons,
        ];

        candidates.push({
          outfitId,
          garmentId: garment.id,
          accessoryIds,
          color: color.hex,
          style: resolvedStyle,
          score: scoreCandidate(factors),
          scoreBreakdown: factors,
          reasons: [...new Set(reasons)],
          adaptiveAdjustmentIds: adjustmentIds,
          cultureRuleIds: culture.ruleIds,
          sourceIds: culture.sourceIds,
          eventId: event.id,
          location: context.location,
          weatherId: weather?.id,
          characterId: context.characterId,
          cultureStatus: culture.status,
        });
      }
    }
  }

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.outfitId, candidate])).values()];
  const requestedLimit = Number.isFinite(context.limit)
    ? Math.floor(context.limit as number)
    : DEFAULT_RECOMMENDATION_LIMIT;
  const limit = Math.max(1, Math.min(requestedLimit, MAX_RECOMMENDATION_LIMIT));
  return selectDiverseCandidates(uniqueCandidates, limit);
}

export function calculateStyleScore(
  garment: Garment,
  primaryColor: string,
  accessoryIds: string[],
  eventId: string,
  styleVibe?: string
): StyleScoreResult {
  let score = 75;
  const feedback: string[] = [];

  const event = eventsList.find((e) => e.id === eventId);
  const isRecommendedForEvent = Boolean(event?.recommendedGarments?.includes(garment.id));

  if (isRecommendedForEvent) {
    score += 15;
    feedback.push(`Phom dáng ${garment.name} hoàn hảo cho tính chất ${event?.name}.`);
  } else {
    feedback.push(`Phom dáng ${garment.name} mang lại sự mới lạ, độc đáo cho sự kiện này.`);
  }

  // Color harmony
  const matchingColor = garment.baseColors.find((c) => c.hex.toLowerCase() === primaryColor.toLowerCase());
  let colorHarmony: 'PERFECT' | 'BALANCED' | 'BOLD' | 'MUTED' = 'BALANCED';

  if (matchingColor) {
    score += 5;
    colorHarmony = 'PERFECT';
    feedback.push(`Màu sắc "${matchingColor.name}" nằm trong bảng phối màu cổ truyền chuẩn xác.`);
  } else {
    colorHarmony = 'BOLD';
    feedback.push('Sắc màu phối phá cách, tôn cá tính riêng.');
  }

  // Accessories harmony
  const compatibleAccs = garment.compatibleAccessoryIds || garment.compatibleAccessories || [];
  const validAccessories = accessoryIds.filter((accId) => compatibleAccs.includes(accId));
  if (validAccessories.length >= 2) {
    score += 5;
    feedback.push('Phụ kiện điểm xuyết ăn ý, tôn thêm thần thái tổng thể.');
  }

  // Style vibe match
  if (styleVibe === 'TOI_GIAN') {
    if (garment.id === 'garment-ngu-than-tay-chen' || garment.id === 'garment-ao-dai-ngu-than-remix') {
      score += 5;
      feedback.push('Thiết kế tối giản, thanh lịch tôn nét tinh tế tự nhiên.');
    }
  } else if (styleVibe === 'REMIX_GEN_Z') {
    if (accessoryIds.includes('acc-sneaker-retro') || garment.id === 'garment-ao-dai-ngu-than-remix') {
      score += 8;
      feedback.push('Phong cách Remix Gen Z phóng khoáng, giao thoa di sản và nhịp sống trẻ.');
    }
  }

  const finalScore = Math.min(100, Math.max(50, score));

  let label = 'Gu Tinh Tế';
  if (finalScore >= 90) label = 'Gu Đỉnh Chóp';
  else if (finalScore >= 80) label = 'Gu Thanh Lịch';
  else if (finalScore >= 70) label = 'Gu Phóng Khoáng';

  return {
    score: finalScore,
    label,
    feedback,
    colorHarmony,
    occasionFit: isRecommendedForEvent ?? false,
  };
}

export function recommendOutfitsDeterministic(params: RecommendationParams): RecommendedCandidate[] {
  const eventAliases: Record<string, string> = {
    LE_TOT_NGHIEP: 'EVENT_GRADUATION',
    TET: 'EVENT_TET',
    DAM_CUOI: 'EVENT_WEDDING',
    SU_KIEN_VAN_HOA: 'EVENT_CULTURAL',
    DAO_PHO: 'EVENT_CASUAL',
  };
  const eventId = getEventById(params.eventId)?.id ?? eventAliases[params.eventId];
  if (!eventId) return [];

  const styleAliases: Record<string, StyleTag> = {
    TRUYEN_THONG_HOANG_GIA: 'TRUYEN_THONG',
  };
  const supportedStyles: StyleTag[] = [
    'TRUYEN_THONG', 'LE_NGHI', 'CUNG_DINH', 'DAN_GIAN', 'TOI_GIAN', 'REMIX_GEN_Z',
    'SANG_TRONG', 'THANH_LICH', 'NANG_DONG', 'HOA_NHAP', 'CO_DIEN',
  ];
  const style = styleAliases[params.styleVibe ?? ''] ??
    supportedStyles.find((tag) => tag === params.styleVibe);
  const recommendations = getDeterministicRecommendations({
    eventId,
    weatherId: params.weatherId,
    style,
    adaptiveNeedCode: params.adaptiveNeedCode as FunctionalNeedCode | 'NONE' | undefined,
  });

  return recommendations.flatMap((candidate) => {
    const garment = getApprovedGarments().find((item) => item.id === candidate.garmentId);
    if (!garment) return [];

    const recommendedAccessories = candidate.accessoryIds.flatMap((id) => {
      const accessory = getApprovedAccessories().find((item) => item.id === id);
      return accessory ? [accessory] : [];
    });
    const culture = checkCulture({
      garmentId: garment.id,
      accessoryIds: candidate.accessoryIds,
      eventId,
      primaryColor: candidate.color,
      adaptiveNeedCode: params.adaptiveNeedCode,
    });
    const styleCheck = calculateStyleScore(
      garment,
      candidate.color,
      candidate.accessoryIds,
      eventId,
      candidate.style,
    );

    return [{
      garment,
      primaryColor: candidate.color,
      pantColor: garment.id === 'garment-ao-tac' || garment.id === 'garment-ao-nhat-binh'
        ? '#F4F0E8'
        : '#1C1C1E',
      recommendedAccessories,
      chuanScore: culture.score,
      chatScore: styleCheck.score,
      totalScore: candidate.score,
      matchReasons: candidate.reasons,
    }];
  });
}
