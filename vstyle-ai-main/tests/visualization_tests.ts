import { createMockupScene } from '../src/lib/visualization/assetRegistry.ts';
import {
  getApprovedAccessories,
  getApprovedGarments,
  getCharacters,
} from '../src/lib/dal/index.ts';
import { Garment } from '../src/types/domain.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`PASS: ${testName}`);
    passed++;
  } else {
    console.error(`FAIL: ${testName}`);
    failed++;
  }
}

const garments = getApprovedGarments();
const accessories = getApprovedAccessories();
const characters = getCharacters();
const colors = garments.flatMap((garment) => garment.baseColors.map((color) => ({ garment, color })));
const backgrounds = ['MINIMAL_STUDIO', 'HERITAGE_PALACE', 'GARDEN_SPRING'] as const;

console.log('--- DETERMINISTIC VISUALIZATION LAYERS ---\n');

assert(garments.length > 0 && characters.length > 0, 'Demo has approved garment and character records');
assert(garments.every((garment) => createMockupScene({
  garment,
  character: characters[0],
  accessories: [],
  primaryColor: garment.baseColors[0].hex,
}).garment.dataId === garment.id), 'Every approved garment resolves to its own garment layer ID');
assert(garments.every((garment) => createMockupScene({
  garment,
  character: characters[0],
  accessories: [],
  primaryColor: garment.baseColors[0].hex,
}).garment.hasVectorTemplate), 'Every approved demo garment has a vector template or a declared generic fallback');
assert(colors.every(({ garment, color }) => createMockupScene({
  garment,
  character: characters[0],
  accessories: [],
  primaryColor: color.hex,
}).garmentColor.value === color.hex), 'Every curated garment color resolves to the garment-color layer');
assert(characters.every((character) => {
  const scene = createMockupScene({
    garment: garments[0],
    character,
    accessories: [],
    primaryColor: garments[0].baseColors[0].hex,
  });
  return scene.character.dataId === character.id && scene.hair.characterId === character.id;
}), 'Every representative character resolves character and hair layers from data IDs');

assert(accessories.every((accessory) => {
  const garment = garments.find((item) => item.id === accessory.compatibleGarmentIds.find((id) => garments.some((g) => g.id === id)));
  if (!garment) return false;
  const scene = createMockupScene({
    garment,
    character: characters[0],
    accessories: [accessory],
    primaryColor: garment.baseColors[0].hex,
  });
  return [...scene.accessories, ...scene.shoes].some((item) => item.dataId === accessory.id);
}), 'Every approved accessory maps to an accessory or shoe vector layer');

assert(backgrounds.every((backgroundId) => createMockupScene({
  garment: garments[0],
  character: characters[0],
  accessories: [],
  primaryColor: garments[0].baseColors[0].hex,
  backgroundId,
}).background.dataId === backgroundId), 'Every demo background theme resolves from metadata');

const selectedAdaptive = createMockupScene({
  garment: garments[0],
  character: characters.find((character) => character.heightCategory === 'SEATED') ?? characters[0],
  accessories: [],
  primaryColor: garments[0].baseColors[0].hex,
  adaptiveNeedCodes: ['WHEELCHAIR_SEATED', 'LIMITED_HAND_MOBILITY'],
  styleId: 'REMIX_GEN_Z',
});
assert(selectedAdaptive.adaptive.needCodes.length === 2, 'All explicit adaptive selections are retained in the scene');
assert(selectedAdaptive.adaptive.isSeated, 'Seated representation activates the seated illustration');
assert(selectedAdaptive.style.dataId === 'REMIX_GEN_Z', 'Selected style ID reaches the scene');
assert(selectedAdaptive.layers.join(',') === 'background,adaptive,character,hair,garmentBottom,garment,garmentColor,accessories,shoes', 'Scene declares the deterministic SVG layer order');
assert(
  createMockupScene({ garment: garments[0], character: characters[0], accessories: [], primaryColor: '#123456' })
    .character.source === null,
  'Unregistered asset paths resolve to vector fallback instead of crashing or requesting missing files',
);

const unknownTemplate = {
  ...garments[0],
  svgTemplate: 'UNKNOWN_TEMPLATE',
} as Garment;
assert(!createMockupScene({
  garment: unknownTemplate,
  character: characters[0],
  accessories: [],
  primaryColor: '#123456',
}).garment.hasVectorTemplate, 'Unknown garment templates are directed to the generic vector fallback');

console.log(`\nVISUALIZATION TESTS: ${passed} PASS, ${failed} FAIL\n`);

if (process.argv[1]?.endsWith('visualization_tests.ts') && failed > 0) {
  process.exit(1);
}

export { passed as visualizationPassed, failed as visualizationFailed };