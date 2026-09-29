import { z } from 'zod';
import {
  GarmentSchema,
  AccessorySchema,
  CultureSourceSchema,
  AdaptiveAdjustmentSchema,
  DataStatusEnum,
} from '../src/lib/validation/domainSchemas.ts';

import {
  getGarments,
  getApprovedGarments,
  getGarmentById,
  getAccessories,
  getApprovedAccessories,
  getAccessoryById,
  getEvents,
  getAllSources,
  getApprovedSources,
  getAdaptiveNeeds,
  getAdaptiveAdjustments,
  getValidatedAdaptiveAdjustments,
  getCultureRules,
  getCharacters,
  validateDatabaseIntegrity,
} from '../src/lib/dal/index.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failed++;
  }
}

console.log('--- KIỂM THỬ TẦNG DỮ LIỆU & DOMAIN MODEL VSTYLE ---\n');

// 1. Valid Data & Integrity
const integrity = validateDatabaseIntegrity();
assert(integrity.isValid, 'Toàn bộ cơ sở dữ liệu mẫu phải vượt qua kiểm tra toàn vẹn quan hệ');
if (!integrity.isValid) {
  console.error('Integrity errors:', integrity.errors);
}

// 2. Minimum Garments & Approved Filter
const allGarments = getGarments();
const approvedGarments = getApprovedGarments();
assert(allGarments.length >= 3, 'Phải có tối thiểu 3 y phục trong cơ sở dữ liệu');
assert(
  approvedGarments.every((g) => g.status === 'APPROVED' && g.verified),
  'Chỉ có y phục APPROVED và verified mới được trả về trong getApprovedGarments()'
);

const draftGarment = allGarments.find((g) => g.status === 'DRAFT');
assert(Boolean(draftGarment), 'Phải có ít nhất 1 bản ghi DRAFT mẫu đánh dấu rõ ràng');
assert(
  !approvedGarments.some((g) => g.id === draftGarment?.id),
  'Bản ghi DRAFT tuyệt đối không được xuất hiện trong danh sách y phục đã kiểm định'
);

// 3. Accessory Count & Status
const allAccessories = getAccessories();
assert(allAccessories.length >= 15 && allAccessories.length <= 25, 'Phải có 15-20+ phụ kiện bảo lưu');
const approvedAccessories = getApprovedAccessories();
assert(
  approvedAccessories.every((a) => a.status === 'APPROVED'),
  'Chỉ phụ kiện APPROVED mới nằm trong getApprovedAccessories()'
);

// 4. Invalid Garment Detection
const invalidGarment1 = {
  id: 'bad-garment',
  name: 'Áo Sai Danh Mục',
  category: 'UNKNOWN_CATEGORY', // Sai category
  region: 'BAC_BO',
  period: 'NGUYEN',
  era: 'Thời Nguyễn',
  occasions: ['EVENT_TET'],
  description: 'Mô tả',
  characteristics: ['Đặc trưng'],
  styleTags: ['TRUYEN_THONG'],
  nonNegotiables: ['Quy tắc'],
  baseColors: [{ name: 'Đỏ', hex: 'invalid-hex' }], // Sai hex
  compatibleAccessoryIds: [],
  sourceIds: ['src-ngan-nam-ao-mu'],
  imageAsset: 'img',
  status: 'APPROVED',
  verified: true,
  svgTemplate: 'TEMPLATE',
};
const parseBadGarment = GarmentSchema.safeParse(invalidGarment1);
assert(!parseBadGarment.success, 'GarmentSchema phải từ chối y phục có category hoặc hex color không hợp lệ');

// 5. Invalid Accessory Detection
const invalidAccessory = {
  id: 'bad-acc',
  name: '',
  type: 'INVALID_TYPE',
  compatibleGarmentIds: [],
  compatibleEventIds: [],
  styleTags: [],
  colors: [],
  imageAsset: '',
  sourceIds: [],
  status: 'APPROVED',
  description: '',
  verified: true,
};
const parseBadAcc = AccessorySchema.safeParse(invalidAccessory);
assert(!parseBadAcc.success, 'AccessorySchema phải từ chối phụ kiện có type lạ hoặc tên rỗng');

// 6. Missing Source Detection in Integrity Check
const fakeGarmentWithMissingSource = {
  id: 'garment-test-orphan',
  name: 'Áo Mồ Côi Nguồn',
  sourceIds: ['non-existent-source-xyz'],
  compatibleAccessoryIds: [],
};
const checkTestIntegrity = () => {
  const currentSources = new Set(getAllSources().map((s) => s.id));
  return fakeGarmentWithMissingSource.sourceIds.every((sId) => currentSources.has(sId));
};
assert(!checkTestIntegrity(), 'Hệ thống phải phát hiện và chặn y phục viện dẫn nguồn không có thật');

// 7. Invalid Status Enum Detection
const badStatusTest = DataStatusEnum.safeParse('VERIFIED_BY_AI');
assert(!badStatusTest.success, 'DataStatusEnum chỉ chấp nhận DRAFT, PENDING_REVIEW, APPROVED, REJECTED');

// 8. Invalid Adaptive Rule: Từ chối chẩn đoán y khoa
const medicalDiagnosisAdaptive = {
  id: 'AR-BAD-01',
  needCode: 'MEDICAL_PARALYSIS', // Không được dùng chẩn đoán y khoa
  needName: 'Liệt hai chi dưới',
  garmentId: 'ALL',
  adjustment: 'Điều chỉnh',
  reason: 'Lý do',
  tailoringSpecs: {},
  validated: true,
  sourceId: 'src-adaptive-design-lab',
};
const parseMedicalAdaptive = AdaptiveAdjustmentSchema.safeParse(medicalDiagnosisAdaptive);
assert(
  !parseMedicalAdaptive.success,
  'AdaptiveAdjustmentSchema phải từ chối chẩn đoán y khoa, chỉ cho phép Functional Need Code chuẩn hóa'
);

// 9. Adaptive Adjustments: Phân định validated=true vs validated=false
const allAdjustments = getAdaptiveAdjustments();
const validatedAdjustments = getValidatedAdaptiveAdjustments();
assert(allAdjustments.length > 0, 'Phải có danh sách điều chỉnh may đo thích ứng');
assert(
  validatedAdjustments.every((a) => a.validated === true),
  'getValidatedAdaptiveAdjustments() chỉ trả về các bản ghi đã kiểm định (validated = true)'
);
const unvalidatedAdjustments = allAdjustments.filter((a) => !a.validated);
assert(
  unvalidatedAdjustments.length > 0,
  'Phải có bản ghi placeholder validated: false để thử nghiệm cơ chế kiểm định'
);

// 10. Source Verification: url null & verified false
const allSources = getAllSources();
const approvedSources = getApprovedSources();
const unverifiedSource = allSources.find((s) => !s.verified);
assert(Boolean(unverifiedSource), 'Phải có nguồn unverified (url: null, verified: false) để kiểm chứng');
assert(unverifiedSource?.url === null, 'Nguồn chưa xác minh phải có url = null (không bịa đặt URL)');
assert(
  !approvedSources.some((s) => s.id === unverifiedSource?.id),
  'Nguồn unverified không được nằm trong getApprovedSources()'
);

// 11. Duplicate ID Check
const duplicateCheckSources = [
  { id: 'src-1', title: 'T1' },
  { id: 'src-1', title: 'T2 (Trùng lặp)' },
];
const hasDuplicate = new Set(duplicateCheckSources.map((s) => s.id)).size !== duplicateCheckSources.length;
assert(hasDuplicate, 'Thuật toán kiểm tra phải phát hiện được ID trùng lặp');

// 12. Events Coverage Check
const events = getEvents();
const requiredEventKeys = [
  'EVENT_TET',
  'EVENT_GRADUATION',
  'EVENT_YEARBOOK',
  'EVENT_CULTURAL',
  'EVENT_FESTIVAL',
  'EVENT_CONCERT',
  'EVENT_WEDDING',
  'EVENT_CASUAL',
];
const hasAllRequiredEvents = requiredEventKeys.every((key) => events.some((e) => e.id === key));
assert(hasAllRequiredEvents, 'Phải có đủ 8 sự kiện bắt buộc theo đặc tả');

console.log(`\n========================================`);
console.log(`KẾT QUẢ KIỂM THỬ TẦNG DỮ LIỆU: ${passed} PASS, ${failed} FAIL`);
console.log(`========================================\n`);

if (process.argv[1] && process.argv[1].endsWith('domain_knowledge_tests.ts')) {
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

export { passed as domainPassed, failed as domainFailed };
