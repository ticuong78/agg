/**
 * The commercial catalogue: tiers, what each unlocks, what each AI action costs.
 * Shared so the pricing page and the API never disagree; the API is still the one that enforces it.
 * Prices are in VND (integers). Credits are the single usage unit across features.
 */

export const Tiers = ['GUEST', 'FREE', 'INDIVIDUAL', 'SCHOOL', 'ENTERPRISE'] as const;
export type Tier = (typeof Tiers)[number];
/** Tiers a customer can buy. */
export const PaidTiers = ['INDIVIDUAL', 'SCHOOL', 'ENTERPRISE'] as const;
export type PaidTier = (typeof PaidTiers)[number];

export const BillingPeriods = ['MONTH', 'YEAR'] as const;
export type BillingPeriod = (typeof BillingPeriods)[number];

/**
 * Billable actions. Reading text documents (PDF with a text layer, Word, plain text) is free for everyone, within a
 * daily number of conversions for guests and free accounts: it is the product's front door. Exports are always free.
 */
export const CreditActions = ['EXTRACT_IMAGE_PAGE', 'REWRITE_SECTION', 'SUGGEST_TESTS'] as const;
export type CreditAction = (typeof CreditActions)[number];

export const CreditCosts: Record<CreditAction, number> = {
  /** Each image, or each page of a scanned PDF: read visually by the AI. */
  EXTRACT_IMAGE_PAGE: 1,
  REWRITE_SECTION: 1,
  /** One batch of suggested tests whose outputs were computed by running code. */
  SUGGEST_TESTS: 3,
};

export const CreditActionLabels: Record<CreditAction, string> = {
  EXTRACT_IMAGE_PAGE: 'Đọc ảnh / trang scan',
  REWRITE_SECTION: 'Viết lại một mục',
  SUGGEST_TESTS: 'Gợi ý test (có chạy code kiểm chứng)',
};

export interface Limits {
  /** Max size of one uploaded file. */
  maxFileMb: number;
  /** Files per upload. */
  maxFilesPerUpload: number;
  /** Problems kept per conversion. */
  maxProblems: number;
  /** Conversions per day (guests and free accounts; paid plans are limited by credits only). */
  dailyConversions: number | null;
  /** How long a conversion (structured result) is kept, in days. Original files are never kept. */
  retentionDays: number;
}

export interface Features {
  images: boolean;
  rewrite: boolean;
  testSuggestions: boolean;
  /** Export formats besides .contest and .md. */
  documentExports: boolean;
  /** School name / header printed on exported statements. */
  branding: boolean;
  /** Several members spending one shared credit pool. */
  sharedPool: boolean;
  priorityQueue: boolean;
  apiAccess: boolean;
  sso: boolean;
}

export interface TierDefinition {
  tier: Tier;
  name: string;
  tagline: string;
  /** VND per period; null = not sold / custom quote. */
  priceMonthly: number | null;
  priceYearly: number | null;
  /** Credits granted each month of the plan. */
  monthlyCredits: number;
  /** Seats included (members of a workspace). */
  seats: number;
  /** VND per extra seat per month (schools). */
  extraSeatMonthly: number | null;
  limits: Limits;
  features: Features;
  /** Human-readable perks for the pricing page, in order of importance. */
  perks: string[];
  highlighted?: boolean;
}

const BASE_FEATURES: Features = {
  images: false, rewrite: false, testSuggestions: false, documentExports: false,
  branding: false, sharedPool: false, priorityQueue: false, apiAccess: false, sso: false,
};

export const TierCatalog: Record<Tier, TierDefinition> = {
  GUEST: {
    tier: 'GUEST',
    name: 'Khách',
    tagline: 'Không cần đăng ký',
    priceMonthly: 0,
    priceYearly: 0,
    monthlyCredits: 0,
    seats: 1,
    extraSeatMonthly: null,
    limits: { maxFileMb: 5, maxFilesPerUpload: 1, maxProblems: 10, dailyConversions: 3, retentionDays: 1 },
    features: BASE_FEATURES,
    perks: ['PDF, Word, văn bản → .contest', '3 lượt/ngày', 'Tối đa 10 bài mỗi lượt', 'Kết quả giữ 24 giờ'],
  },
  FREE: {
    tier: 'FREE',
    name: 'Miễn phí',
    tagline: 'Cho giáo viên muốn dùng thử AI',
    priceMonthly: 0,
    priceYearly: 0,
    monthlyCredits: 10,
    seats: 1,
    extraSeatMonthly: null,
    limits: { maxFileMb: 10, maxFilesPerUpload: 3, maxProblems: 20, dailyConversions: 10, retentionDays: 30 },
    features: { ...BASE_FEATURES, images: true, rewrite: true, testSuggestions: true, documentExports: true },
    perks: [
      '10 lượt chuyển đổi mỗi ngày',
      '30 credit khi đăng ký, nạp lại 10 credit mỗi tháng',
      'Đọc đề từ ảnh và PDF scan',
      'AI viết lại đề, gợi ý test',
      'Xuất .docx, .doc, .pdf, .md',
      'Lưu lịch sử 30 ngày',
    ],
  },
  INDIVIDUAL: {
    tier: 'INDIVIDUAL',
    name: 'Giáo viên',
    tagline: 'Cho một giáo viên ra đề thường xuyên',
    priceMonthly: 99_000,
    priceYearly: 990_000,
    monthlyCredits: 400,
    seats: 1,
    extraSeatMonthly: null,
    limits: { maxFileMb: 25, maxFilesPerUpload: 10, maxProblems: 50, dailyConversions: null, retentionDays: 365 },
    features: { ...BASE_FEATURES, images: true, rewrite: true, testSuggestions: true, documentExports: true, priorityQueue: true },
    perks: [
      'Không giới hạn lượt chuyển đổi tài liệu văn bản',
      '400 credit mỗi tháng (~400 ảnh/trang scan hoặc ~130 bộ test)',
      'Tải 10 tệp một lần, tối đa 25 MB/tệp',
      'Tối đa 50 bài mỗi bộ đề',
      'Xử lý ưu tiên',
      'Lưu lịch sử 1 năm',
      'Gói năm: tặng 2 tháng',
    ],
    highlighted: true,
  },
  SCHOOL: {
    tier: 'SCHOOL',
    name: 'Tổ chuyên môn',
    tagline: 'Cho tổ Tin học, trường, trung tâm',
    priceMonthly: 1_290_000,
    priceYearly: 12_900_000,
    monthlyCredits: 8_000,
    seats: 15,
    extraSeatMonthly: 49_000,
    limits: { maxFileMb: 50, maxFilesPerUpload: 30, maxProblems: 100, dailyConversions: null, retentionDays: 730 },
    features: {
      ...BASE_FEATURES, images: true, rewrite: true, testSuggestions: true, documentExports: true,
      priorityQueue: true, branding: true, sharedPool: true,
    },
    perks: [
      '8.000 credit/tháng dùng chung — rẻ hơn 35% mỗi credit so với gói Giáo viên',
      '15 thành viên (thêm 49.000đ/người/tháng)',
      'Tên trường, tiêu đề kỳ thi in sẵn trên đề xuất ra',
      'Quản lý thành viên và xem mức dùng của từng người',
      'Hoá đơn VAT, thanh toán chuyển khoản',
      'Hỗ trợ ưu tiên qua Zalo',
      'Lưu lịch sử 2 năm',
    ],
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Doanh nghiệp',
    tagline: 'Cho Sở/Phòng GD&ĐT, hệ thống trường, đơn vị đào tạo',
    priceMonthly: null,
    priceYearly: null,
    monthlyCredits: 50_000,
    seats: 1_000,
    extraSeatMonthly: null,
    limits: { maxFileMb: 100, maxFilesPerUpload: 100, maxProblems: 300, dailyConversions: null, retentionDays: 1825 },
    features: {
      ...BASE_FEATURES, images: true, rewrite: true, testSuggestions: true, documentExports: true,
      priorityQueue: true, branding: true, sharedPool: true, apiAccess: true, sso: true,
    },
    perks: [
      'Credit theo nhu cầu, giá thấp nhất',
      'Không giới hạn thành viên, nhiều đơn vị con',
      'API để tích hợp vào hệ thống sẵn có',
      'Đăng nhập một lần (Google Workspace, Microsoft 365)',
      'Triển khai riêng, dữ liệu lưu tại Việt Nam, hợp đồng xử lý dữ liệu (DPA)',
      'Cam kết SLA 99,9% và người phụ trách riêng',
      'Mẫu đề xuất ra theo yêu cầu',
    ],
  },
};

/** One-off credit packs for any signed-in user, on top of a plan. Valid 12 months. */
export interface TopUpPack {
  id: string;
  credits: number;
  price: number;
  label: string;
}

export const TopUpPacks: TopUpPack[] = [
  { id: 'pack-100', credits: 100, price: 49_000, label: '100 credit' },
  { id: 'pack-500', credits: 500, price: 199_000, label: '500 credit' },
  { id: 'pack-2000', credits: 2_000, price: 690_000, label: '2.000 credit' },
];
export const TOPUP_VALID_DAYS = 365;

/** Welcome credits on signup; FREE accounts are refilled to the monthly amount, never above the cap. */
export const WELCOME_CREDITS = 30;
export const FREE_MONTHLY_CAP = 30;

/** Credits earned through activities (growth). */
export const RewardCredits = {
  SURVEY: 20,
  REFERRAL: 30,
  REFERRED_SIGNUP: 10,
  FEEDBACK: 5,
  BUG_REPORT_MIN: 10,
  BUG_REPORT_MAX: 50,
  USER_RESEARCH: 50,
} as const;
/** Referral rewards stop counting after this many in one month (abuse ceiling). */
export const MAX_REFERRALS_PER_MONTH = 20;
export const FEEDBACK_COOLDOWN_DAYS = 30;

export const formatVnd = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

/**
 * GD-7: how long the MVP keeps each kind of data. The privacy page, the cleanup jobs, the web and a test that reads
 * deploy/backup.sh and deploy/docker-compose.yml all use these values, so the page cannot promise what the code
 * does not do.
 */
export const Retention = {
  /** A guest's set (exam text, file names): the guest plan's retention, swept hourly. */
  guestSetHours: TierCatalog.GUEST.limits.retentionDays * 24,
  /** Daily allowance counters (browser id, hashed IP): only today's is needed; older ones are deleted daily. */
  usageCounterDays: 2,
  /** Anonymous product events (problem count, export format; no id): deleted daily after this. */
  analyticsDays: 730,
  /** Access keys kept in the guest's browser, pruned after this (longer than a set lives, never shorter). */
  browserKeyHours: 48,
  /** Nightly database backups are deleted after this; guest sets and counters are left out of them. */
  backupDays: 14,
  /** Container logs are rotated by size: this many files of this size per service, then overwritten. */
  logFiles: 3,
  logFileMb: 10,
} as const;
