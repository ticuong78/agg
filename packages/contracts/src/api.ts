import type {
  ConversionStatus, ExportFormat, ExtractionEngine, IoMode, LeadSource, OrderStatus, PaymentProvider,
  ReviewStatus, RewardActivity, Role, SourceKind, TextSection, WorkspaceRole, CreditSource,
} from './enums';
import type { BillingPeriod, CreditAction, Features, Limits, PaidTier, Tier } from './plans';

/** Every error answer of the API. `code` is a stable English identifier; `message` is shown to users. */
export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, string>;
}

/** Header carrying the anonymous visitor id (kept in the browser's localStorage). */
export const VISITOR_HEADER = 'x-visitor-id';
/** Header carrying the secret that lets a guest open their own conversion. */
export const ACCESS_KEY_HEADER = 'x-access-key';

// ---------- Identity ----------

export interface RequestCodeRequest {
  email: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
  name?: string;
  /** Referral code from an invitation link (?ref=...). */
  referralCode?: string;
  marketingConsent?: boolean;
}

export interface WorkspaceRefDto {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface MeDto {
  id: string;
  email: string;
  name: string;
  role: Role;
  referralCode: string;
  marketingConsent: boolean;
}

export interface AuthResponse {
  token: string;
  user: MeDto;
}

export interface UpdateProfileRequest {
  name?: string;
  marketingConsent?: boolean;
}

// ---------- Conversion ----------

export interface TestCaseDto {
  id: string;
  input: string;
  output: string;
  isSample: boolean;
  /** Points Themis gives for the test. */
  score: number;
  /** Why the AI proposed it (suggested tests only). */
  purpose?: string;
  /** The output was computed by running code (suggested tests only). */
  verified?: boolean;
}

export interface ProblemDto {
  id: string;
  /** Themis task name: folder and file names (BAI1 -> BAI1.INP / BAI1.OUT). */
  code: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  tests: TestCaseDto[];
  warnings: string[];
}

export interface ContestSettingsDto {
  name: string;
  ioMode: IoMode;
  /** Printed on top of exported statements (school tier and above). */
  header: string;
  /** Statements are put next to the tests inside the .contest archive. */
  includeStatements: boolean;
}

export interface SourceDto {
  name: string;
  kind: SourceKind;
  sizeBytes: number;
  pages: number | null;
}

export interface ConversionDto {
  id: string;
  status: ConversionStatus;
  engine: ExtractionEngine | null;
  sources: SourceDto[];
  problems: ProblemDto[];
  settings: ContestSettingsDto;
  failure: string | null;
  creditsCharged: number;
  createdAt: string;
  expiresAt: string;
}

export interface ConversionSummaryDto {
  id: string;
  name: string;
  status: ConversionStatus;
  problemCount: number;
  createdAt: string;
  expiresAt: string;
}

export interface CreateConversionResponse {
  conversion: ConversionDto;
  /** Guests only: keep it to reopen the conversion. Accounts open their conversions by ownership. */
  accessKey: string | null;
}

export interface PasteTextRequest {
  text: string;
}

export interface TestCaseInput {
  id?: string;
  input: string;
  output: string;
  isSample: boolean;
  score: number;
}

export interface UpdateProblemRequest {
  code?: string;
  title?: string;
  statement?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  tests?: TestCaseInput[];
}

export interface ReorderProblemsRequest {
  problemIds: string[];
}

export type UpdateSettingsRequest = Partial<ContestSettingsDto>;

export interface RewriteSectionRequest {
  section: TextSection;
  /** Optional wish of the teacher ("ngắn gọn hơn", "thêm câu chuyện"...). */
  instruction?: string;
}

export interface RewriteSectionResponse {
  section: TextSection;
  text: string;
  notes: string[];
  creditsLeft: number;
}

export interface SuggestTestsRequest {
  count: number;
  focus?: string;
}

export interface TestSuggestionDto {
  input: string;
  output: string;
  purpose: string;
  verified: boolean;
}

export interface SuggestTestsResponse {
  suggestions: TestSuggestionDto[];
  notes: string[];
  /** Parts of the teacher's wish that were refused because they contradict the statement. */
  focusRejections: string[];
  creditsLeft: number;
}

export interface ExportFormatInfo {
  format: ExportFormat;
  label: string;
  extension: string;
  /** Needs an account (FREE and above). */
  requiresAccount: boolean;
}

// ---------- Billing / usage ----------

export interface CreditBucketDto {
  source: CreditSource;
  remaining: number;
  expiresAt: string | null;
}

export interface UsageDto {
  tier: Tier;
  tierName: string;
  credits: number;
  buckets: CreditBucketDto[];
  limits: Limits;
  features: Features;
  costs: Record<CreditAction, number>;
  /** Guests: conversions used today out of the daily allowance. */
  guest: { usedToday: number; dailyLimit: number } | null;
  plan: { tier: PaidTier; period: BillingPeriod; endsAt: string } | null;
  /** The workspace whose shared pool the user spends, when they belong to one. */
  workspace: WorkspaceRefDto | null;
}

export interface LedgerEntryDto {
  id: string;
  at: string;
  /** Positive = credits granted, negative = spent. */
  amount: number;
  reason: string;
  reference: string | null;
}

export type CheckoutProduct =
  | { kind: 'PLAN'; tier: Exclude<PaidTier, 'ENTERPRISE'>; period: BillingPeriod; extraSeats?: number }
  | { kind: 'TOPUP'; packId: string };

export interface CheckoutRequest {
  product: CheckoutProduct;
  provider: PaymentProvider;
  /** Name of the workspace created by a SCHOOL purchase. */
  workspaceName?: string;
}

export interface BankTransferDto {
  imageUrl: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  /** Must appear in the transfer description; matches the transfer to the order. */
  content: string;
}

export interface CheckoutResponse {
  orderId: string;
  /** Hosted payment page (Stripe, VNPay, MoMo). */
  redirectUrl: string | null;
  /** Bank transfer instructions (VietQR). */
  bankTransfer: BankTransferDto | null;
}

export interface OrderDto {
  id: string;
  code: string;
  description: string;
  amount: number;
  provider: PaymentProvider;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentMethodDto {
  provider: PaymentProvider;
  label: string;
  available: boolean;
}

export interface WorkspaceMemberDto {
  email: string;
  role: WorkspaceRole;
  joined: boolean;
  creditsUsedThisMonth: number;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  header: string;
  seatLimit: number;
  members: WorkspaceMemberDto[];
}

export interface InviteMemberRequest {
  email: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  header?: string;
}

// ---------- Growth ----------

export interface VisitRequest {
  visitorId: string;
  landingPath: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  language?: string;
}

export interface ConsentRequest {
  visitorId: string;
  analytics: boolean;
  marketing: boolean;
}

export interface TrackEvent {
  name: string;
  path?: string;
  props?: Record<string, string | number | boolean>;
}

export interface TrackEventsRequest {
  visitorId: string;
  events: TrackEvent[];
}

export interface GuestLeadRequest {
  email: string;
  name?: string;
  marketingConsent: boolean;
  conversionId?: string;
}

export interface SurveyRequest {
  role: string;
  organization: string;
  organizationType: string;
  province: string;
  subjects: string[];
  studentsCount: string;
  currentTools: string[];
  painPoints: string;
  interestedFeatures: string[];
  phone?: string;
  contactConsent: boolean;
}

export interface FeedbackRequest {
  rating: number;
  message: string;
}

export interface BugReportRequest {
  title: string;
  steps: string;
  expected: string;
  actual: string;
  conversionId?: string;
  pageUrl?: string;
}

export interface ContactSalesRequest {
  name: string;
  email: string;
  phone?: string;
  organization: string;
  organizationType: string;
  seats?: number;
  message?: string;
  interest: PaidTier;
  marketingConsent: boolean;
}

export interface ResearchSignupRequest {
  availability: string;
  phone?: string;
}

export interface RewardActivityDto {
  activity: RewardActivity;
  credits: number;
  /** Can be done now. */
  available: boolean;
  /** Why not / what happens next. */
  detail: string;
}

export interface RewardsDto {
  activities: RewardActivityDto[];
  referralCode: string;
  referralsThisMonth: number;
  referralsTotal: number;
  creditsEarned: number;
}

export interface RewardResultDto {
  creditsGranted: number;
  pendingReview: boolean;
  message: string;
}

// ---------- Admin ----------

export interface LeadDto {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  organization: string | null;
  sources: LeadSource[];
  marketingConsent: boolean;
  userId: string | null;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewItemDto {
  id: string;
  kind: 'BUG_REPORT' | 'USER_RESEARCH';
  userEmail: string;
  title: string;
  body: string;
  status: ReviewStatus;
  createdAt: string;
}

export interface ReviewDecisionRequest {
  approve: boolean;
  credits?: number;
  note?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
}
