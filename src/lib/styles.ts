import type { StyleTag } from '../types/domain.ts';

export type StyleChoiceId =
  | 'TRUYEN_THONG_HOANG_GIA'
  | 'CONTEMPORARY'
  | 'TOI_GIAN'
  | 'NANG_DONG'
  | 'REMIX_GEN_Z'
  | 'SANG_TRONG';

export interface StyleChoice {
  id: StyleChoiceId;
  label: string;
  description: string;
  tag: StyleTag;
}

/** The six style directions a user can pick; shared by the UI, the parser allow-list and the renderer. */
export const STYLE_CHOICES: StyleChoice[] = [
  { id: 'TRUYEN_THONG_HOANG_GIA', label: 'Cổ điển', description: 'Nét cổ điển, tiết chế và trang nhã.', tag: 'TRUYEN_THONG' },
  { id: 'CONTEMPORARY', label: 'Đương đại', description: 'Phối Việt phục cùng tinh thần hiện đại.', tag: 'REMIX_GEN_Z' },
  { id: 'TOI_GIAN', label: 'Tối giản', description: 'Đường nét gọn, tập trung vào phom dáng.', tag: 'TOI_GIAN' },
  { id: 'NANG_DONG', label: 'Năng động', description: 'Nhẹ nhàng, linh hoạt và tươi mới.', tag: 'NANG_DONG' },
  { id: 'REMIX_GEN_Z', label: 'Remix Gen Z', description: 'Tự do phối lớp theo nhịp sống trẻ.', tag: 'REMIX_GEN_Z' },
  { id: 'SANG_TRONG', label: 'Sang trọng', description: 'Sắc thái thanh lịch cho dịp trang trọng.', tag: 'SANG_TRONG' },
];

export const STYLE_CHOICE_IDS = STYLE_CHOICES.map((style) => style.id);

export const STYLE_VIBE_BY_TAG: Partial<Record<StyleTag, StyleChoiceId>> = {
  TRUYEN_THONG: 'TRUYEN_THONG_HOANG_GIA',
  LE_NGHI: 'TRUYEN_THONG_HOANG_GIA',
  CUNG_DINH: 'SANG_TRONG',
  DAN_GIAN: 'TRUYEN_THONG_HOANG_GIA',
  CO_DIEN: 'TRUYEN_THONG_HOANG_GIA',
  REMIX_GEN_Z: 'REMIX_GEN_Z',
  HOA_NHAP: 'REMIX_GEN_Z',
  TOI_GIAN: 'TOI_GIAN',
  NANG_DONG: 'NANG_DONG',
  SANG_TRONG: 'SANG_TRONG',
  THANH_LICH: 'SANG_TRONG',
};

export function styleLabel(id: string): string {
  return STYLE_CHOICES.find((style) => style.id === id)?.label ?? id.replaceAll('_', ' ').toLowerCase();
}

export function styleTagFor(id: string): StyleTag {
  return STYLE_CHOICES.find((style) => style.id === id)?.tag ?? 'TRUYEN_THONG';
}
