/**
 * Vstyle Data Access Layer (DAL)
 * Centralized, validated, and strongly typed repository access for traditional fashion data
 */

import { z } from 'zod';
import type {
  Garment,
  Accessory,
  Event,
  CultureRule,
  CultureSource,
  AdaptiveNeed,
  AdaptiveAdjustment,
  Character,
  WeatherContext,
  GarmentCategory,
  FunctionalNeedCode,
} from '../../types/domain.ts';

import {
  GarmentSchema,
  AccessorySchema,
  EventSchema,
  CultureRuleSchema,
  CultureSourceSchema,
  AdaptiveNeedSchema,
  AdaptiveAdjustmentSchema,
  CharacterSchema,
} from '../validation/domainSchemas.ts';

// Raw JSON imports
import rawGarments from '../../../data/garments.json' with { type: 'json' };
import rawAccessories from '../../../data/accessories.json' with { type: 'json' };
import rawEvents from '../../../data/events.json' with { type: 'json' };
import rawSources from '../../../data/sources.json' with { type: 'json' };
import rawCultureRules from '../../../data/culture_rules.json' with { type: 'json' };
import rawAdaptiveNeeds from '../../../data/adaptive_needs.json' with { type: 'json' };
import rawAdaptiveAdjustments from '../../../data/adaptive_rules.json' with { type: 'json' };
import rawCharacters from '../../../data/characters.json' with { type: 'json' };
import rawWeather from '../../../data/weather_context.json' with { type: 'json' };

export class DataValidationError extends Error {
  entity: string;
  zodErrors: z.ZodError | string;

  constructor(entity: string, zodErrors: z.ZodError | string) {
    super(`[Vstyle DAL Validation Error] in ${entity}: ${typeof zodErrors === 'string' ? zodErrors : JSON.stringify(zodErrors.format(), null, 2)}`);
    this.name = 'DataValidationError';
    this.entity = entity;
    this.zodErrors = zodErrors;
  }
}

// Internal validated caches
let garmentsCache: Garment[] = [];
let accessoriesCache: Accessory[] = [];
let eventsCache: Event[] = [];
let sourcesCache: CultureSource[] = [];
let cultureRulesCache: CultureRule[] = [];
let adaptiveNeedsCache: AdaptiveNeed[] = [];
let adaptiveAdjustmentsCache: AdaptiveAdjustment[] = [];
let charactersCache: Character[] = [];
let weatherCache: WeatherContext[] = [];

let isInitialized = false;

export function initializeAndValidateDatabase(): void {
  if (isInitialized) return;

  // 1. Validate Sources
  const parsedSources = z.array(CultureSourceSchema).safeParse(rawSources);
  if (!parsedSources.success) {
    throw new DataValidationError('sources.json', parsedSources.error);
  }
  sourcesCache = parsedSources.data as unknown as CultureSource[];

  // 2. Validate Garments
  const parsedGarments = z.array(GarmentSchema).safeParse(rawGarments);
  if (!parsedGarments.success) {
    throw new DataValidationError('garments.json', parsedGarments.error);
  }
  garmentsCache = parsedGarments.data as unknown as Garment[];

  // 3. Validate Accessories
  const parsedAccessories = z.array(AccessorySchema).safeParse(rawAccessories);
  if (!parsedAccessories.success) {
    throw new DataValidationError('accessories.json', parsedAccessories.error);
  }
  accessoriesCache = parsedAccessories.data as unknown as Accessory[];

  // 4. Validate Events
  const parsedEvents = z.array(EventSchema).safeParse(rawEvents);
  if (!parsedEvents.success) {
    throw new DataValidationError('events.json', parsedEvents.error);
  }
  eventsCache = parsedEvents.data as unknown as Event[];

  // 5. Validate Culture Rules
  const parsedRules = z.array(CultureRuleSchema).safeParse(rawCultureRules);
  if (!parsedRules.success) {
    throw new DataValidationError('culture_rules.json', parsedRules.error);
  }
  cultureRulesCache = parsedRules.data as unknown as CultureRule[];

  // 6. Validate Adaptive Needs
  const parsedNeeds = z.array(AdaptiveNeedSchema).safeParse(rawAdaptiveNeeds);
  if (!parsedNeeds.success) {
    throw new DataValidationError('adaptive_needs.json', parsedNeeds.error);
  }
  adaptiveNeedsCache = parsedNeeds.data as unknown as AdaptiveNeed[];

  // 7. Validate Adaptive Adjustments
  const parsedAdjustments = z.array(AdaptiveAdjustmentSchema).safeParse(rawAdaptiveAdjustments);
  if (!parsedAdjustments.success) {
    throw new DataValidationError('adaptive_rules.json', parsedAdjustments.error);
  }
  adaptiveAdjustmentsCache = parsedAdjustments.data as unknown as AdaptiveAdjustment[];

  // 8. Validate Characters
  const parsedCharacters = z.array(CharacterSchema).safeParse(rawCharacters);
  if (!parsedCharacters.success) {
    throw new DataValidationError('characters.json', parsedCharacters.error);
  }
  charactersCache = parsedCharacters.data as unknown as Character[];

  weatherCache = rawWeather as unknown as WeatherContext[];

  // Run relational integrity check
  const integrity = validateDatabaseIntegrity();
  if (!integrity.isValid) {
    throw new DataValidationError('Relational Integrity Check', integrity.errors.join('; '));
  }

  isInitialized = true;
}

/**
 * Validates relational integrity across the entire database:
 * - Duplicate ID checks
 * - Foreign reference checks
 */
export function validateDatabaseIntegrity(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const checkDuplicates = (items: { id?: string; code?: string }[], name: string) => {
    const seen = new Set<string>();
    for (const item of items) {
      const key = item.id || item.code || '';
      if (seen.has(key)) {
        errors.push(`Duplicate ID found in ${name}: ${key}`);
      }
      seen.add(key);
    }
  };

  const currentSources = sourcesCache.length > 0 ? sourcesCache : (rawSources as any[]);
  const currentGarments = garmentsCache.length > 0 ? garmentsCache : (rawGarments as any[]);
  const currentAccessories = accessoriesCache.length > 0 ? accessoriesCache : (rawAccessories as any[]);
  const currentRules = cultureRulesCache.length > 0 ? cultureRulesCache : (rawCultureRules as any[]);
  const currentNeeds = adaptiveNeedsCache.length > 0 ? adaptiveNeedsCache : (rawAdaptiveNeeds as any[]);
  const currentAdjustments = adaptiveAdjustmentsCache.length > 0 ? adaptiveAdjustmentsCache : (rawAdaptiveAdjustments as any[]);
  const currentCharacters = charactersCache.length > 0 ? charactersCache : (rawCharacters as any[]);

  checkDuplicates(currentSources, 'sources.json');
  checkDuplicates(currentGarments, 'garments.json');
  checkDuplicates(currentAccessories, 'accessories.json');
  checkDuplicates(currentRules, 'culture_rules.json');
  checkDuplicates(currentNeeds, 'adaptive_needs.json');
  checkDuplicates(currentAdjustments, 'adaptive_rules.json');
  checkDuplicates(currentCharacters, 'characters.json');

  const sourceIds = new Set(currentSources.map((s) => s.id));
  const accessoryIds = new Set(currentAccessories.map((a) => a.id));
  const garmentIds = new Set(currentGarments.map((g) => g.id));
  const needCodes = new Set(currentNeeds.map((n) => n.code));

  // Check Garment references
  for (const g of currentGarments) {
    for (const sId of g.sourceIds) {
      if (!sourceIds.has(sId)) {
        errors.push(`Garment "${g.id}" references nonexistent source "${sId}"`);
      }
    }
    const accList = g.compatibleAccessoryIds || g.compatibleAccessories || [];
    for (const aId of accList) {
      if (!accessoryIds.has(aId)) {
        errors.push(`Garment "${g.id}" references nonexistent accessory "${aId}"`);
      }
    }
  }

  // Check Accessory references
  for (const a of currentAccessories) {
    const sIds = a.sourceIds || (a.sourceId ? [a.sourceId] : []);
    for (const sId of sIds) {
      if (!sourceIds.has(sId)) {
        errors.push(`Accessory "${a.id}" references nonexistent source "${sId}"`);
      }
    }
  }

  // Check Adaptive Adjustments references
  for (const adj of currentAdjustments) {
    if (!needCodes.has(adj.needCode)) {
      errors.push(`Adaptive Adjustment "${adj.id}" references nonexistent needCode "${adj.needCode}"`);
    }
    if (adj.sourceId && !sourceIds.has(adj.sourceId)) {
      errors.push(`Adaptive Adjustment "${adj.id}" references nonexistent source "${adj.sourceId}"`);
    }
    if (adj.garmentId !== 'ALL' && !garmentIds.has(adj.garmentId)) {
      errors.push(`Adaptive Adjustment "${adj.id}" references nonexistent garment "${adj.garmentId}"`);
    }
  }

  // Check Culture Rules references
  for (const r of currentRules) {
    if (r.sourceId && !sourceIds.has(r.sourceId)) {
      errors.push(`Culture Rule "${r.id}" references nonexistent source "${r.sourceId}"`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Auto-initialize on import
try {
  initializeAndValidateDatabase();
} catch (e) {
  console.warn('Initial DAL auto-initialization deferred or failed:', e);
}

// ==========================================
// DOMAIN-LEVEL DATA ACCESS FUNCTIONS
// ==========================================

// 1. Garments
export function getGarments(): Garment[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return garmentsCache;
}

export function getApprovedGarments(): Garment[] {
  return getGarments().filter((g) => g.status === 'APPROVED' && g.verified);
}

export function getGarmentById(id: string): Garment | undefined {
  return getGarments().find((g) => g.id === id);
}

export function getGarmentsByCategory(category: GarmentCategory): Garment[] {
  return getApprovedGarments().filter((g) => g.category === category);
}

export function getGarmentsByOccasion(occasionId: string): Garment[] {
  return getApprovedGarments().filter((g) => {
    const list = g.occasions || g.occasion || [];
    return list.includes(occasionId);
  });
}

// 2. Accessories
export function getAccessories(): Accessory[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return accessoriesCache;
}

export function getApprovedAccessories(): Accessory[] {
  return getAccessories().filter((a) => a.status === 'APPROVED');
}

export function getAccessoryById(id: string): Accessory | undefined {
  return getAccessories().find((a) => a.id === id);
}

export function getAccessoriesForGarment(garmentId: string): Accessory[] {
  return getApprovedAccessories().filter((a) => a.compatibleGarmentIds.includes(garmentId));
}

// 3. Events
export function getEvents(): Event[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return eventsCache;
}

export function getEventById(id: string): Event | undefined {
  return getEvents().find((e) => e.id === id);
}

// 4. Sources
export function getAllSources(): CultureSource[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return sourcesCache;
}

export function getApprovedSources(): CultureSource[] {
  return getAllSources().filter((s) => s.verified && s.url !== null);
}

export function getSourceById(id: string): CultureSource | undefined {
  return getAllSources().find((s) => s.id === id);
}

// 5. Culture Rules
export function getCultureRules(): CultureRule[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return cultureRulesCache;
}

export function getCultureRuleById(id: string): CultureRule | undefined {
  return getCultureRules().find((r) => r.id === id);
}

// 6. Adaptive Needs & Adjustments
export function getAdaptiveNeeds(): AdaptiveNeed[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return adaptiveNeedsCache;
}

export function getAdaptiveNeedByCode(code: FunctionalNeedCode): AdaptiveNeed | undefined {
  return getAdaptiveNeeds().find((n) => n.code === code);
}

export function getAdaptiveAdjustments(): AdaptiveAdjustment[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return adaptiveAdjustmentsCache;
}

export function getValidatedAdaptiveAdjustments(): AdaptiveAdjustment[] {
  return getAdaptiveAdjustments().filter((a) => a.validated);
}

export function getAdaptiveAdjustmentByNeed(needCode?: string, garmentId?: string): AdaptiveAdjustment | undefined {
  if (!needCode || needCode === 'NONE') return undefined;
  return getAdaptiveAdjustments().find(
    (a) => a.needCode === needCode && (a.garmentId === 'ALL' || a.garmentId === garmentId)
  );
}

// 7. Characters
export function getCharacters(): Character[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return charactersCache;
}

export function getCharacterById(id: string): Character | undefined {
  return getCharacters().find((c) => c.id === id);
}

// 8. Weather Context
export function getWeatherContexts(): WeatherContext[] {
  if (!isInitialized) initializeAndValidateDatabase();
  return weatherCache;
}

export function getWeatherContextById(id: string): WeatherContext | undefined {
  return getWeatherContexts().find((w) => w.id === id);
}
