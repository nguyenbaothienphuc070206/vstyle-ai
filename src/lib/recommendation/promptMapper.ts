import type { FunctionalNeedCode } from '../../types/domain.ts';
import type { StyleChoiceId } from '../styles.ts';

export interface SafeStylingPromptMapping {
  eventId?: string;
  weatherId?: string;
  styleId?: StyleChoiceId;
  garmentId?: string;
  needCodes: FunctionalNeedCode[];
}

function normalizeVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

const EVENT_KEYWORDS: Array<[string[], string]> = [
  [['tot nghiep', 'graduation', 'nhan bang'], 'EVENT_GRADUATION'],
  [['ky yeu', 'yearbook', 'chup anh lop'], 'EVENT_YEARBOOK'],
  [['dam cuoi', 'le cuoi', 'dam hoi', 'an hoi', 'wedding', 'gia tien'], 'EVENT_WEDDING'],
  [['tet', 'du xuan', 'chuc tet', 'le chua'], 'EVENT_TET'],
  [['hoa nhac', 'concert', 'dem nhac', 'nha hat'], 'EVENT_CONCERT'],
  [['le hoi', 'hoi lang', 'quan ho', 'festival'], 'EVENT_FESTIVAL'],
  [['trien lam', 'bao tang', 'su kien van hoa', 'ngay hoi viet phuc', 'di san'], 'EVENT_CULTURAL'],
  [['dao pho', 'cafe', 'ca phe', 'check-in', 'check in', 'cuoi tuan', 'di choi'], 'EVENT_CASUAL'],
];

const WEATHER_KEYWORDS: Array<[string[], string]> = [
  [['troi nong', 'oi buc', 'nang nong', 'nang gat', 'hot'], 'WEATHER_HOT'],
  [['diu mat', 'mat me', 'mua thu', 'mua xuan', 'pleasant'], 'WEATHER_PLEASANT'],
  [['troi mua', 'mua rao', 'mua phun', 'mua bao', 'am uot', 'rain'], 'WEATHER_HUMID_RAIN'],
  [['lanh', 'troi ret', 'gio dong', 'cold', 'cool'], 'WEATHER_COOL'],
];

const STYLE_KEYWORDS: Array<[string[], StyleChoiceId]> = [
  [['toi gian', 'minimal', 'don gian'], 'TOI_GIAN'],
  [['gen z', 'remix', 'ca tinh', 'phong khoang'], 'REMIX_GEN_Z'],
  [['nang dong', 'tre trung', 'tuoi tre'], 'NANG_DONG'],
  [['sang trong', 'elegant', 'quy phai', 'lich lam'], 'SANG_TRONG'],
  [['hien dai', 'duong dai', 'contemporary'], 'CONTEMPORARY'],
  [['truyen thong', 'co dien', 'traditional', 'nguyen ban'], 'TRUYEN_THONG_HOANG_GIA'],
];

const GARMENT_KEYWORDS: Array<[string[], string]> = [
  [['nhat binh'], 'garment-ao-nhat-binh'],
  [['ao tac', 'ao thung'], 'garment-ao-tac'],
  [['giao linh'], 'garment-ao-giao-linh'],
  [['doi kham'], 'garment-ao-doi-kham'],
  [['tu than'], 'garment-ao-tu-than'],
  [['ngu than cach tan', 'ngu than remix', 'tan thoi'], 'garment-ao-dai-ngu-than-remix'],
  [['ngu than'], 'garment-ngu-than-tay-chen'],
  [['ao dai'], 'garment-ao-dai-truyen-thong'],
];

const NEED_KEYWORDS: Array<[string[], FunctionalNeedCode]> = [
  [['xe lan', 'wheelchair'], 'WHEELCHAIR_SEATED'],
  [['kho cai cuc', 'tay yeu', 'khop ngon tay', 'kho cam nam'], 'LIMITED_HAND_MOBILITY'],
  [['da nhay cam', 'di ung vai', 'ngua'], 'MATERIAL_SENSITIVITY'],
  [['dung lau', 'kho dung', 'dung day kho'], 'LIMITED_STANDING'],
  [['kho gio tay', 'vai cung', 'han che van dong vai'], 'LIMITED_MOBILITY'],
];

function firstMatch<T>(normalized: string, table: Array<[string[], T]>): T | undefined {
  return table.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)))?.[1];
}

/**
 * Keyword fallback used when Gemini is unavailable. It maps only explicit, unambiguous words;
 * everything else stays empty for the user to choose manually.
 */
export function mapSafeStylingPrompt(text: string): SafeStylingPromptMapping {
  const normalized = normalizeVietnamese(text);
  return {
    eventId: firstMatch(normalized, EVENT_KEYWORDS),
    weatherId: firstMatch(normalized, WEATHER_KEYWORDS),
    styleId: firstMatch(normalized, STYLE_KEYWORDS),
    garmentId: firstMatch(normalized, GARMENT_KEYWORDS),
    needCodes: NEED_KEYWORDS
      .filter(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
      .map(([, code]) => code),
  };
}
