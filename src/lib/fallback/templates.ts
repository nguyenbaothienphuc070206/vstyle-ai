import type { CultureCheckResult, Garment } from '../../types/fashion';

/**
 * Offline fallbacks used only when the Vstyle server cannot be reached.
 * They reuse verified data (garment characteristics, rule-engine reasons) instead of inventing claims.
 */
export function getFallbackExplanation(garment: Garment, cultureResult: CultureCheckResult, eventName: string) {
  const reasons = cultureResult.reasons.slice(0, 2).join(' ');
  return {
    headline: `${garment.name} cho ${eventName}`.slice(0, 140),
    editorialReview: garment.description.slice(0, 700),
    culturalHarmony: (reasons || `Kết quả kiểm tra văn hóa: ${cultureResult.score}/100.`).slice(0, 500),
    styleRemixVerdict: `Điểm Chuẩn ${cultureResult.score}/100 do bộ quy tắc Vstyle chấm; lời bình AI sẽ xuất hiện khi kết nối lại.`,
    adviceForWearing: garment.characteristics.slice(0, 3).map((item) => item.slice(0, 180)),
  };
}

export function getFallbackCaptions(garmentName: string, eventName: string) {
  return {
    instagramCaption: `Diện ${garmentName} cho ${eventName} — phối theo gu mình, giữ đúng bản sắc. #Vstyle #VietPhucRemix`,
    shortPunchyHook: `${garmentName}, phối theo gu của bạn.`.slice(0, 120),
    culturalHighlight: 'Bản phối đã qua bộ quy tắc văn hóa có nguồn của Vstyle.',
    hashtags: ['#Vstyle', '#VietPhucRemix'],
  };
}
