import { StyleTag } from '../../types/domain';

export interface SafeStylingPromptMapping {
  eventId?: string;
  weatherId?: string;
  style?: StyleTag;
}

function normalizeVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Maps only explicit, unambiguous demo keywords. Unrecognized values stay manual. */
export function mapSafeStylingPrompt(text: string): SafeStylingPromptMapping {
  const normalized = normalizeVietnamese(text);
  const mapping: SafeStylingPromptMapping = {};

  if (normalized.includes('tot nghiep') || normalized.includes('graduation')) {
    mapping.eventId = 'EVENT_GRADUATION';
  } else if (normalized.includes('tet')) {
    mapping.eventId = 'EVENT_TET';
  } else if (normalized.includes('hoa nhac') || normalized.includes('concert')) {
    mapping.eventId = 'EVENT_CONCERT';
  } else if (normalized.includes('dam cuoi') || normalized.includes('le cuoi')) {
    mapping.eventId = 'EVENT_WEDDING';
  } else if (normalized.includes('le hoi') || normalized.includes('hoi lang')) {
    mapping.eventId = 'EVENT_FESTIVAL';
  }

  if (normalized.includes('troi nong') || normalized.includes('oi buc') || normalized.includes('hot weather')) {
    mapping.weatherId = 'WEATHER_HOT';
  } else if (normalized.includes('mua') || normalized.includes('rain')) {
    mapping.weatherId = 'WEATHER_HUMID_RAIN';
  } else if (normalized.includes('lanh') || normalized.includes('cool weather')) {
    mapping.weatherId = 'WEATHER_COOL';
  } else if (normalized.includes('diu mat') || normalized.includes('pleasant weather')) {
    mapping.weatherId = 'WEATHER_PLEASANT';
  }

  if (normalized.includes('toi gian') || normalized.includes('minimal')) {
    mapping.style = 'TOI_GIAN';
  } else if (normalized.includes('gen z') || normalized.includes('tre trung')) {
    mapping.style = 'REMIX_GEN_Z';
  } else if (normalized.includes('sang trong') || normalized.includes('elegant')) {
    mapping.style = 'SANG_TRONG';
  } else if (normalized.includes('thanh lich')) {
    mapping.style = 'THANH_LICH';
  } else if (normalized.includes('truyen thong') || normalized.includes('traditional')) {
    mapping.style = 'TRUYEN_THONG';
  }

  return mapping;
}