import manifest from '../../../data/visual_assets.json' with { type: 'json' };
import { Accessory, CharacterItem, Garment } from '../../types/fashion';

export type VisualAssetKind = 'character' | 'garment' | 'accessory' | 'background';

export interface VisualAssetReference {
  dataId: string;
  assetId: string;
  kind: VisualAssetKind;
  source: string | null;
  fallbackKey: string;
}

export interface MockupSceneInput {
  garment: Garment;
  character: CharacterItem;
  accessories: Accessory[];
  primaryColor: string;
  adaptiveNeedCodes?: string[];
  backgroundId?: keyof typeof manifest.backgrounds;
  styleId?: string;
}

export interface MockupScene {
  background: VisualAssetReference & { accent: string };
  character: VisualAssetReference & { variant: string; poseId: string };
  garment: VisualAssetReference & { templateId: string; hasVectorTemplate: boolean };
  garmentColor: { dataId: string; value: string };
  hair: { dataId: string; characterId: string; fallbackKey: string };
  accessories: Array<VisualAssetReference & { variant: string; color: string | null }>;
  shoes: Array<VisualAssetReference & { variant: string; color: string | null }>;
  adaptive: { dataId: string; needCodes: string[]; isSeated: boolean };
  style: { dataId: string; accent: string };
  layers: string[];
}

const typedManifest = manifest as {
  assetRoots: Record<VisualAssetKind, string>;
  availableAssets: string[];
  supportedGarmentTemplates: string[];
  backgrounds: Record<string, { fallbackKey: string; accent: string }>;
  characterVariants: Record<string, string>;
  accessoryVariants: Record<string, string>;
  styleAccents: Record<string, string>;
};

const DEFAULT_STYLE_ACCENT = '#D6A75B';

export function resolveVisualAsset(
  kind: VisualAssetKind,
  dataId: string,
  assetId: string,
  fallbackKey: string,
): VisualAssetReference {
  const available = typedManifest.availableAssets.includes(assetId);
  return {
    dataId,
    assetId,
    kind,
    source: available ? `${typedManifest.assetRoots[kind]}/${encodeURIComponent(assetId)}.svg` : null,
    fallbackKey,
  };
}

export function createMockupScene(input: MockupSceneInput): MockupScene {
  const backgroundId = input.backgroundId ?? 'MINIMAL_STUDIO';
  const backgroundMeta = typedManifest.backgrounds[backgroundId] ?? typedManifest.backgrounds.MINIMAL_STUDIO;
  const characterVariant = typedManifest.characterVariants[input.character.imageAsset] ?? 'CHARACTER_BASE';
  const adaptiveNeedCodes = [...new Set(input.adaptiveNeedCodes ?? [])];
  const character = resolveVisualAsset(
    'character',
    input.character.id,
    input.character.imageAsset,
    characterVariant,
  );
  const accessories = input.accessories.map((item) => ({
    ...resolveVisualAsset(
      'accessory',
      item.id,
      item.imageAsset,
      typedManifest.accessoryVariants[item.imageAsset] ?? `ACCESSORY_${item.type}`,
    ),
    variant: typedManifest.accessoryVariants[item.imageAsset] ?? `ACCESSORY_${item.type}`,
    color: item.colors[0] ?? null,
  }));

  return {
    background: {
      ...resolveVisualAsset('background', backgroundId, backgroundId, backgroundMeta.fallbackKey),
      accent: backgroundMeta.accent,
    },
    character: { ...character, variant: characterVariant, poseId: input.character.pose },
    garment: {
      ...resolveVisualAsset('garment', input.garment.id, input.garment.imageAsset, input.garment.svgTemplate),
      templateId: input.garment.svgTemplate,
      hasVectorTemplate: typedManifest.supportedGarmentTemplates.includes(input.garment.svgTemplate),
    },
    garmentColor: { dataId: input.primaryColor.toLowerCase(), value: input.primaryColor },
    hair: {
      dataId: `${input.character.id}:${input.character.pose}:HAIR`,
      characterId: input.character.id,
      fallbackKey: `${characterVariant}_HAIR`,
    },
    accessories: accessories.filter((item) => !item.variant.startsWith('SHOES_')),
    shoes: accessories.filter((item) => item.variant.startsWith('SHOES_')),
    adaptive: {
      dataId: adaptiveNeedCodes.length ? adaptiveNeedCodes.join('+') : 'NONE',
      needCodes: adaptiveNeedCodes,
      isSeated: adaptiveNeedCodes.includes('WHEELCHAIR_SEATED') || input.character.heightCategory === 'SEATED',
    },
    style: {
      dataId: input.styleId ?? 'TRUYEN_THONG',
      accent: typedManifest.styleAccents[input.styleId ?? 'TRUYEN_THONG'] ?? DEFAULT_STYLE_ACCENT,
    },
    layers: ['background', 'adaptive', 'character', 'hair', 'garmentBottom', 'garment', 'garmentColor', 'accessories', 'shoes'],
  };
}