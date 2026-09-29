/**
 * Deterministic colour-harmony check for an outfit (đề bài: "Kiểm tra sự hài hòa của màu sắc").
 * Event colour guidance is derived only from the verified `culturalAdvice` text in data/events.json,
 * so this module never invents cultural claims of its own.
 */
import { contrastRatio, hexToHsl, hueDistance, normalizeHex } from './colorMath.ts';

export type ColorFamily =
  | 'RED'
  | 'ORANGE'
  | 'YELLOW'
  | 'GREEN'
  | 'BLUE'
  | 'PURPLE'
  | 'PINK'
  | 'BROWN'
  | 'LIGHT'
  | 'DARK'
  | 'GRAY';

export type HarmonyRelation =
  | 'NEUTRAL_BASE'
  | 'MONOCHROME'
  | 'ANALOGOUS'
  | 'COMPLEMENTARY'
  | 'TRIADIC'
  | 'OFF_KEY';

export interface HarmonyInput {
  primaryColor: string;
  pantColor: string;
  accessoryColors?: string[];
  eventAdvice?: string;
  eventName?: string;
}

export interface HarmonyNote {
  tone: 'good' | 'info' | 'warn';
  text: string;
}

export interface HarmonyResult {
  score: number;
  label: 'Hài hòa' | 'Cân đối' | 'Cần cân nhắc';
  relation: HarmonyRelation;
  relationLabel: string;
  primaryFamily: ColorFamily;
  pantFamily: ColorFamily;
  eventFamilies: ColorFamily[];
  matchesEventGuidance: boolean | null;
  contrast: number;
  notes: HarmonyNote[];
}

export const FAMILY_LABELS: Record<ColorFamily, string> = {
  RED: 'đỏ',
  ORANGE: 'cam',
  YELLOW: 'vàng',
  GREEN: 'xanh lá',
  BLUE: 'xanh lam',
  PURPLE: 'tím',
  PINK: 'hồng',
  BROWN: 'nâu đất',
  LIGHT: 'trắng/ngà',
  DARK: 'đen/sẫm',
  GRAY: 'xám',
};

const NEUTRALS: ColorFamily[] = ['LIGHT', 'DARK', 'GRAY', 'BROWN'];

export function colorFamily(hex: string): ColorFamily {
  const { h, s, l } = hexToHsl(hex);
  if (l < 16 || (s < 14 && l < 32)) return 'DARK';
  if ((l > 86 && s < 45) || (s < 14 && l > 70)) return 'LIGHT';
  if (s < 14) return 'GRAY';
  if (h >= 12 && h < 48 && l < 42 && s < 75) return 'BROWN';
  if (h < 12 || h >= 345) return l > 68 ? 'PINK' : 'RED';
  if (h < 38) return 'ORANGE';
  if (h < 68) return 'YELLOW';
  if (h < 165) return 'GREEN';
  if (h < 255) return 'BLUE';
  if (h < 300) return 'PURPLE';
  return 'PINK';
}

/** Vietnamese colour words used in verified event advice → colour families. Longest match first. */
const ADVICE_COLOR_WORDS: Array<[string, ColorFamily[]]> = [
  ['xanh thiên thanh', ['BLUE']],
  ['xanh cốm', ['GREEN']],
  ['xanh lam', ['BLUE']],
  ['xanh rêu', ['GREEN']],
  ['trắng ngà', ['LIGHT']],
  ['vàng mỡ gà', ['YELLOW']],
  ['vàng hoàng thổ', ['YELLOW', 'BROWN']],
  ['hoàng thổ', ['YELLOW', 'BROWN']],
  ['cam đất', ['ORANGE', 'BROWN']],
  ['đỏ chu sa', ['RED']],
  ['chu sa', ['RED']],
  ['hồng điều', ['RED', 'PINK']],
  ['hồng phấn', ['PINK']],
  ['hồng đào', ['PINK']],
  ['đỏ', ['RED']],
  ['vàng', ['YELLOW']],
  ['cam', ['ORANGE']],
  ['hồng', ['PINK']],
  ['tím', ['PURPLE']],
  ['nâu', ['BROWN']],
  ['trắng', ['LIGHT']],
];

export function familiesFromAdvice(advice?: string): ColorFamily[] {
  if (!advice) return [];
  let text = advice.toLowerCase();
  const families = new Set<ColorFamily>();
  for (const [word, mapped] of ADVICE_COLOR_WORDS) {
    if (text.includes(word)) {
      mapped.forEach((family) => families.add(family));
      text = text.replaceAll(word, ' ');
    }
  }
  return [...families];
}

function isVivid(hex: string): boolean {
  const { s, l } = hexToHsl(hex);
  return s >= 35 && l > 18 && l < 85;
}

const RELATION_LABELS: Record<HarmonyRelation, string> = {
  NEUTRAL_BASE: 'Nền trung tính',
  MONOCHROME: 'Đơn sắc',
  ANALOGOUS: 'Tương đồng',
  COMPLEMENTARY: 'Tương phản bổ túc',
  TRIADIC: 'Bộ ba cân bằng',
  OFF_KEY: 'Lệch tông',
};

export function evaluateColorHarmony(input: HarmonyInput): HarmonyResult {
  const primary = normalizeHex(input.primaryColor) ?? '#000000';
  const pant = normalizeHex(input.pantColor) ?? '#000000';
  const accessoryColors = (input.accessoryColors ?? [])
    .map((color) => normalizeHex(color))
    .filter((color): color is string => Boolean(color));
  const primaryFamily = colorFamily(primary);
  const pantFamily = colorFamily(pant);
  const notes: HarmonyNote[] = [];
  let score = 72;

  const primaryHsl = hexToHsl(primary);
  const pantHsl = hexToHsl(pant);
  const hueGap = hueDistance(primaryHsl.h, pantHsl.h);
  let relation: HarmonyRelation;

  if (NEUTRALS.includes(primaryFamily) || NEUTRALS.includes(pantFamily)) {
    relation = primaryFamily === pantFamily ? 'MONOCHROME' : 'NEUTRAL_BASE';
    score += relation === 'MONOCHROME' ? 6 : 14;
    notes.push({
      tone: 'good',
      text: relation === 'MONOCHROME'
        ? 'Áo và quần cùng một họ màu trung tính: tổng thể liền mạch, nên thêm một phụ kiện có màu để tạo điểm nhấn.'
        : `Nền ${FAMILY_LABELS[NEUTRALS.includes(pantFamily) ? pantFamily : primaryFamily]} giúp sắc ${FAMILY_LABELS[NEUTRALS.includes(pantFamily) ? primaryFamily : pantFamily]} nổi bật mà không bị rối.`,
    });
  } else if (hueGap < 18 && primaryFamily === pantFamily) {
    relation = 'MONOCHROME';
    score += 8;
    notes.push({ tone: 'good', text: 'Phối đơn sắc (tone-sur-tone): sang và gọn, hợp phong cách tối giản.' });
  } else if (hueGap < 45) {
    relation = 'ANALOGOUS';
    score += 12;
    notes.push({ tone: 'good', text: 'Hai màu nằm cạnh nhau trên vòng màu nên chuyển tiếp mềm mại, dễ mặc.' });
  } else if (hueGap >= 150) {
    relation = 'COMPLEMENTARY';
    score += 6;
    notes.push({ tone: 'info', text: 'Tương phản bổ túc rất bắt mắt, đúng tinh thần Gen Z. Giữ phụ kiện trung tính để bản phối không bị "gắt".' });
  } else if (hueGap >= 105 && hueGap <= 135) {
    relation = 'TRIADIC';
    score += 3;
    notes.push({ tone: 'info', text: 'Hai màu cách đều trên vòng màu (bộ ba). Hãy để một màu làm chủ đạo, màu còn lại chỉ điểm xuyết.' });
  } else {
    relation = 'OFF_KEY';
    score -= 10;
    notes.push({ tone: 'warn', text: 'Hai màu chính hơi lệch tông với nhau. Cân nhắc đổi màu quần sang trung tính (ngà, đen, nâu) để bản phối hài hòa hơn.' });
  }

  const contrast = contrastRatio(primary, pant);
  if (contrast < 1.25 && relation !== 'MONOCHROME') {
    score -= 6;
    notes.push({ tone: 'warn', text: 'Áo và quần có độ sáng gần giống nhau, nhìn xa dễ bị "bệt" thành một khối.' });
  }

  const vividHues = [primary, pant, ...accessoryColors].filter(isVivid).map((hex) => colorFamily(hex));
  const distinctVivid = new Set(vividHues);
  if (distinctVivid.size >= 4) {
    score -= 10;
    notes.push({ tone: 'warn', text: `Có ${distinctVivid.size} màu rực cùng lúc — hơi nhiều điểm nhấn. Bớt một phụ kiện nhiều màu sẽ gọn mắt hơn.` });
  } else if (accessoryColors.length > 0 && distinctVivid.size <= 2) {
    score += 4;
    notes.push({ tone: 'good', text: 'Phụ kiện giữ đúng bảng màu của bộ đồ, không tranh sự chú ý với tà áo.' });
  }

  const eventFamilies = familiesFromAdvice(input.eventAdvice);
  let matchesEventGuidance: boolean | null = null;
  if (eventFamilies.length) {
    matchesEventGuidance = eventFamilies.includes(primaryFamily);
    if (matchesEventGuidance) {
      score += 8;
      notes.push({ tone: 'good', text: `Sắc ${FAMILY_LABELS[primaryFamily]} nằm trong gợi ý màu của dịp ${input.eventName ?? 'này'}.` });
    } else {
      score -= 3;
      notes.push({
        tone: 'info',
        text: `Gợi ý màu cho ${input.eventName ?? 'dịp này'}: ${eventFamilies.map((family) => FAMILY_LABELS[family]).join(', ')}. Màu hiện tại vẫn dùng được, nhưng chưa đúng gợi ý.`,
      });
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: finalScore,
    label: finalScore >= 85 ? 'Hài hòa' : finalScore >= 70 ? 'Cân đối' : 'Cần cân nhắc',
    relation,
    relationLabel: RELATION_LABELS[relation],
    primaryFamily,
    pantFamily,
    eventFamilies,
    matchesEventGuidance,
    contrast: Math.round(contrast * 100) / 100,
    notes,
  };
}
