import { z } from 'zod';

export const DataStatusEnum = z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED']);
export const RegionEnum = z.enum(['BAC_BO', 'TRUNG_BO', 'NAM_BO', 'TOAN_QUOC']);
export const HistoricalPeriodEnum = z.enum(['LY', 'TRAN', 'LE', 'NGUYEN', 'DUONG_DAI']);
export const GarmentCategoryEnum = z.enum([
  'AO_DAI',
  'AO_TU_THAN',
  'AO_NGU_THAN',
  'AO_TAC',
  'AO_NHAT_BINH',
  'AO_GIAO_LINH',
  'AO_DOI_KHAM',
  'AO_DAI_REMIX',
]);
export const FormalityLevelEnum = z.enum(['CASUAL_SMART', 'SEMI_FORMAL', 'FORMAL', 'HIGH_FORMAL']);
export const WeatherSensitivityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export const CultureStatusEnum = z.enum(['KEEP', 'CONSIDER', 'WARNING']);
export const AccessoryTypeEnum = z.enum([
  'HEADWEAR',
  'HAIR_ACCESSORY',
  'JEWELRY',
  'PENDANT',
  'HANDHELD',
  'FOOTWEAR',
  'BAG',
  'BELT_SASH',
]);
export const FunctionalNeedCodeEnum = z.enum([
  'WHEELCHAIR_SEATED',
  'LIMITED_HAND_MOBILITY',
  'MATERIAL_SENSITIVITY',
  'LIMITED_STANDING',
  'LIMITED_MOBILITY',
]);
export const AdaptiveNeedCategoryEnum = z.enum(['MOBILITY', 'DEXTERITY', 'SENSORY', 'POSTURE']);

// 1. Culture Source Schema
export const CultureSourceSchema = z.object({
  id: z.string().min(1, 'Source ID cannot be empty'),
  title: z.string().min(1, 'Source title cannot be empty'),
  publisher: z.string().min(1, 'Publisher cannot be empty'),
  author: z.string().optional(),
  year: z.number().int().optional(),
  url: z.string().nullable(),
  verified: z.boolean(),
  reviewedBy: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  notes: z.string(),
});

// 2. Garment Schema
export const GarmentColorSchema = z.object({
  name: z.string().min(1),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color format'),
});

export const GarmentSchema = z.object({
  id: z.string().min(1, 'Garment ID cannot be empty'),
  name: z.string().min(1, 'Garment name cannot be empty'),
  vietnameseTitle: z.string(),
  category: GarmentCategoryEnum,
  region: RegionEnum,
  period: HistoricalPeriodEnum,
  era: z.string(),
  occasions: z.array(z.string()).min(1, 'Garment must support at least one occasion'),
  description: z.string().min(1, 'Garment description is required'),
  characteristics: z.array(z.string()).min(1, 'Characteristics required'),
  styleTags: z.array(z.string()),
  nonNegotiables: z.array(z.string()),
  baseColors: z.array(GarmentColorSchema).min(1, 'At least one base color is required'),
  compatibleAccessoryIds: z.array(z.string()),
  sourceIds: z.array(z.string()).min(1, 'Garment must cite at least one verified source'),
  imageAsset: z.string(),
  status: DataStatusEnum,
  verified: z.boolean(),
  svgTemplate: z.string(),
  // Legacy aliases allowed for compatibility
  occasion: z.array(z.string()).optional(),
  compatibleAccessories: z.array(z.string()).optional(),
  culturalMeaning: z.string().optional(),
  formalityLevel: FormalityLevelEnum.optional(),
  genderCompatibility: z.array(z.enum(['MALE', 'FEMALE', 'UNISEX'])).optional(),
});

// 3. Accessory Schema
export const AccessorySchema = z.object({
  id: z.string().min(1, 'Accessory ID cannot be empty'),
  name: z.string().min(1, 'Accessory name cannot be empty'),
  type: AccessoryTypeEnum,
  compatibleGarmentIds: z.array(z.string()),
  compatibleEventIds: z.array(z.string()),
  styleTags: z.array(z.string()),
  colors: z.array(z.string()),
  imageAsset: z.string(),
  sourceIds: z.array(z.string()),
  status: DataStatusEnum,
  description: z.string(),
  verified: z.boolean(),
  // Legacy aliases allowed
  category: AccessoryTypeEnum.optional(),
  culturalRole: z.string().optional(),
  periodCompatibility: z.array(z.string()).optional(),
  sourceId: z.string().optional(),
});

// 4. Event Schema
export const EventSchema = z.object({
  id: z.string().min(1, 'Event ID cannot be empty'),
  name: z.string().min(1, 'Event name cannot be empty'),
  description: z.string(),
  formality: FormalityLevelEnum,
  weatherSensitivity: WeatherSensitivityEnum,
  recommendedStyleTags: z.array(z.string()),
  recommendedGarments: z.array(z.string()).optional(),
  culturalAdvice: z.string().optional(),
});

// 5. Culture Rule Schema
export const RuleSeverityEnum = z.enum(['KEEP', 'CONSIDER', 'WARNING']);

export const RuleConditionSchema = z.object({
  type: z.enum([
    'PRESERVED_STRUCTURE',
    'REQUIRE_ACCESSORY_ON_EVENT',
    'REQUIRE_ACCESSORY_ALWAYS',
    'FORBID_COLOR_ON_EVENT',
    'INCOMPATIBLE_ACCESSORY_ON_EVENT',
    'ADAPTIVE_PRESERVATION',
    'CUSTOM',
  ]),
  targetGarments: z.array(z.string()).optional(),
  targetEvents: z.array(z.string()).optional(),
  requiredAccessoryTypes: z.array(AccessoryTypeEnum).optional(),
  requiredAccessoryIds: z.array(z.string()).optional(),
  forbiddenColors: z.array(z.string()).optional(),
  incompatibleAccessories: z.array(z.string()).optional(),
  requiresPreservedTrait: z.enum([
    'HUU_NHAM',
    'NGU_THAN_CONSTRUCTION',
    'NHAT_BINH_RECTANGULAR_COLLAR',
  ]).optional(),
}).superRefine((condition, context) => {
  const requires = (field: 'requiresPreservedTrait' | 'requiredAccessoryIds' | 'forbiddenColors' | 'incompatibleAccessories') => {
    const value = condition[field];
    if (!value || (Array.isArray(value) && value.length === 0)) {
      context.addIssue({ code: 'custom', path: [field], message: `${field} is required for ${condition.type}` });
    }
  };

  switch (condition.type) {
    case 'PRESERVED_STRUCTURE':
      requires('requiresPreservedTrait');
      break;
    case 'REQUIRE_ACCESSORY_ON_EVENT':
    case 'REQUIRE_ACCESSORY_ALWAYS':
      requires('requiredAccessoryIds');
      break;
    case 'FORBID_COLOR_ON_EVENT':
      requires('forbiddenColors');
      break;
    case 'INCOMPATIBLE_ACCESSORY_ON_EVENT':
      requires('incompatibleAccessories');
      break;
  }
});

export const CultureRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  condition: RuleConditionSchema,
  severity: RuleSeverityEnum,
  reason: z.string().min(1),
  sourceIds: z.array(z.string()).min(1, 'Culture rule must cite at least one source'),
  status: DataStatusEnum,
  // Legacy aliases allowed for compatibility
  weight: z.number().min(0).max(100).optional(),
  applicableGarments: z.array(z.string()).optional(),
  checkType: z.string().optional(),
  sourceId: z.string().optional(),
  verified: z.boolean().optional(),
});

// 6. Adaptive Need Schema
export const AdaptiveNeedSchema = z.object({
  code: FunctionalNeedCodeEnum,
  name: z.string(),
  category: AdaptiveNeedCategoryEnum,
  description: z.string(),
  rationale: z.string(),
});

// 7. Adaptive Adjustment Schema
export const AdaptiveAdjustmentSchema = z.object({
  id: z.string().min(1),
  needCode: FunctionalNeedCodeEnum,
  needName: z.string(),
  garmentId: z.string(),
  adjustment: z.string(),
  reason: z.string(),
  tailoringSpecs: z.record(z.string(), z.string().optional()),
  validated: z.boolean(),
  sourceId: z.string(),
});

// 8. Representative Character Schema
export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'UNISEX']),
  bodyRepresentation: z.string(),
  skinTone: z.string(),
  pose: z.string(),
  heightCategory: z.enum(['REGULAR', 'SEATED', 'TALL']),
  imageAsset: z.string(),
  description: z.string(),
  posture: z.string().optional(),
  defaultSkinTone: z.string().optional(),
  avatarUrl: z.string().optional(),
});

// 9. Outfit Schema
export const OutfitSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  garmentId: z.string(),
  primaryColor: z.string(),
  pantColor: z.string(),
  accessoryIds: z.array(z.string()),
  characterId: z.string(),
  hairStyle: z.string(),
  footwear: z.string(),
  adaptiveNeedCode: z.string().optional(),
  adaptiveNeedCodes: z.array(FunctionalNeedCodeEnum).optional(),
  includeAdaptiveInShare: z.boolean().optional(),
  eventId: z.string(),
  eventDate: z.string().optional(),
  location: z.string().optional(),
  weatherId: z.string(),
  styleVibe: z.string(),
  chuanScore: z.number().min(0).max(100),
  chatScore: z.number().min(0).max(100),
  cultureStatus: CultureStatusEnum,
  retainedCharacteristics: z.array(z.string()),
  sources: z.array(z.string()),
  explanation: z.string().optional(),
  caption: z.string().optional(),
  createdAt: z.string(),
  isFavorite: z.boolean().optional(),
});
