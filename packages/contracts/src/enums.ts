export const Roles = ['USER', 'ADMIN'] as const;
export type Role = (typeof Roles)[number];

/** What a source document is, decided from its extension and its first bytes. */
export const SourceKinds = ['PASTED', 'TEXT', 'DOCX', 'PDF', 'IMAGE'] as const;
export type SourceKind = (typeof SourceKinds)[number];

export const ConversionStatuses = ['PROCESSING', 'READY', 'FAILED'] as const;
export type ConversionStatus = (typeof ConversionStatuses)[number];

/** Who read the documents: the AI reader or the rule-based parser (fallback, and guests when AI is off). */
export const ExtractionEngines = ['AI', 'BASIC'] as const;
export type ExtractionEngine = (typeof ExtractionEngines)[number];

export const ExportFormats = ['contest', 'docx', 'doc', 'pdf', 'md'] as const;
export type ExportFormat = (typeof ExportFormats)[number];

/**
 * GD-3: `mvp` (the default when unset) opens only the guest path, upload or paste, review, export to Themis; `full`
 * opens everything. The API reads APP_MODE, the web NEXT_PUBLIC_APP_MODE; set them together.
 */
export const AppModes = ['mvp', 'full'] as const;
export type AppMode = (typeof AppModes)[number];
/** Turns a raw setting into a mode: unset means `mvp`; anything unknown is null, so the caller can refuse it. */
export const parseAppMode = (raw: string | undefined | null): AppMode | null => {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return 'mvp';
  return (AppModes as readonly string[]).includes(value) ? (value as AppMode) : null;
};
/** The only export the MVP offers: statements travel inside the .contest; Word, PDF and Markdown are out. */
export const MvpExportFormats: readonly ExportFormat[] = ['contest'];

/** Themis reads tests from files named after the task (BAI1.INP / BAI1.OUT) or from standard input/output. */
export const IoModes = ['FILE', 'STDIO'] as const;
export type IoMode = (typeof IoModes)[number];

export const TextSections = ['title', 'statement', 'inputFormat', 'outputFormat', 'constraints'] as const;
export type TextSection = (typeof TextSections)[number];
export const TextSectionLabels: Record<TextSection, string> = {
  title: 'Tên bài',
  statement: 'Đề bài',
  inputFormat: 'Dữ liệu vào',
  outputFormat: 'Kết quả',
  constraints: 'Ràng buộc',
};

export const PaymentProviders = ['STRIPE', 'VNPAY', 'MOMO', 'VIETQR'] as const;
export type PaymentProvider = (typeof PaymentProviders)[number];
export const PaymentProviderLabels: Record<PaymentProvider, string> = {
  STRIPE: 'Thẻ quốc tế (Stripe)',
  VNPAY: 'VNPay',
  MOMO: 'Ví MoMo',
  VIETQR: 'Chuyển khoản VietQR',
};

export const OrderStatuses = ['PENDING', 'PAID', 'FAILED', 'EXPIRED'] as const;
export type OrderStatus = (typeof OrderStatuses)[number];

export const CreditSources = ['WELCOME', 'MONTHLY_FREE', 'PLAN', 'TOPUP', 'REWARD', 'ADJUSTMENT'] as const;
export type CreditSource = (typeof CreditSources)[number];

export const RewardActivities = ['SURVEY', 'REFERRAL', 'REFERRED_SIGNUP', 'FEEDBACK', 'BUG_REPORT', 'USER_RESEARCH'] as const;
export type RewardActivity = (typeof RewardActivities)[number];

export const ReviewStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof ReviewStatuses)[number];

export const LeadSources = ['GUEST_EMAIL', 'SIGNUP', 'SURVEY', 'CONTACT_SALES', 'RESEARCH_SIGNUP'] as const;
export type LeadSource = (typeof LeadSources)[number];

export const WorkspaceRoles = ['OWNER', 'MEMBER'] as const;
export type WorkspaceRole = (typeof WorkspaceRoles)[number];
