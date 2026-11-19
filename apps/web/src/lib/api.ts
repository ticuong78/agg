import {
  ACCESS_KEY_HEADER, VISITOR_HEADER,
  type ApiErrorBody, type AuthResponse, type BugReportRequest, type CheckoutRequest, type CheckoutResponse, type ConsentRequest,
  type ContactSalesRequest, type ConversionDto, type ConversionSummaryDto, type CreateConversionResponse, type ExportFormat,
  type ExportFormatInfo, type FeedbackRequest, type GuestLeadRequest, type LeadDto, type LedgerEntryDto, type MeDto, type OrderDto,
  type Page, type PaymentMethodDto, type ProblemDto, type ResearchSignupRequest, type ReviewDecisionRequest, type ReviewItemDto,
  type RewardResultDto, type RewardsDto, type RewriteSectionRequest, type RewriteSectionResponse, type SuggestTestsRequest,
  type SuggestTestsResponse, type SurveyRequest, type TrackEvent, type UpdateProblemRequest, type UpdateSettingsRequest,
  type UsageDto, type VerifyCodeRequest, type VisitRequest, type WorkspaceDto,
} from '@agg/contracts';
import { API_URL, MVP } from './config';
import { accessKeyFor } from './guest-keys';
import { getToken } from './token';
import { getVisitorId } from './visitor';

/** Every API error, with the stable code and the message to show. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
  }

  /** 402 answers say what would unlock the action: signing in or upgrading. */
  get upgradeAction(): 'signin' | 'upgrade' | null {
    if (this.status !== 402) return null;
    return this.details.action === 'signin' ? 'signin' : 'upgrade';
  }
}

interface Options {
  method?: string;
  body?: unknown;
  /** The conversion whose guest key to send. */
  conversionId?: string;
  raw?: boolean;
}

function headers(conversionId?: string, json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  // GD-3: no accounts in the MVP; an old token in this browser is not sent (the API would ignore it anyway).
  const token = MVP ? null : getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  const visitor = getVisitorId();
  if (visitor) h[VISITOR_HEADER] = visitor;
  const key = conversionId ? accessKeyFor(conversionId) : null;
  if (key) h[ACCESS_KEY_HEADER] = key;
  return h;
}

async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiError(res.status, body?.code ?? 'request.failed', body?.message ?? 'Không kết nối được máy chủ. Vui lòng thử lại.', body?.details);
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? (options.body ? 'POST' : 'GET'),
      headers: headers(options.conversionId, !isForm && options.body !== undefined),
      body: isForm ? (options.body as FormData) : options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
  }
  if (!res.ok) throw await failure(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Downloads a file response and hands it to the browser. */
async function download(path: string, conversionId: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_URL}/api${path}`, { headers: headers(conversionId, false) }).catch(() => null);
  if (!res) throw new ApiError(0, 'network', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
  if (!res.ok) throw await failure(res);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const name = encoded ? decodeURIComponent(encoded) : fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const api = {
  // Identity
  requestCode: (email: string) => request<void>('/auth/code', { body: { email } }),
  verifyCode: (body: VerifyCodeRequest) => request<AuthResponse>('/auth/verify', { body }),
  me: () => request<MeDto>('/auth/me'),
  updateMe: (body: { name?: string; marketingConsent?: boolean }) => request<MeDto>('/auth/me', { method: 'PATCH', body }),
  deleteMe: () => request<void>('/auth/me', { method: 'DELETE' }),

  // Conversions
  formats: () => request<ExportFormatInfo[]>('/conversions/formats'),
  upload: (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    return request<CreateConversionResponse>('/conversions', { body: form });
  },
  paste: (text: string) => request<CreateConversionResponse>('/conversions/text', { body: { text } }),
  conversions: () => request<ConversionSummaryDto[]>('/conversions'),
  conversion: (id: string) => request<ConversionDto>(`/conversions/${id}`, { conversionId: id }),
  claim: (id: string) => request<ConversionDto>(`/conversions/${id}/claim`, { method: 'POST', conversionId: id }),
  deleteConversion: (id: string) => request<void>(`/conversions/${id}`, { method: 'DELETE', conversionId: id }),
  updateSettings: (id: string, body: UpdateSettingsRequest) => request<ConversionDto>(`/conversions/${id}/settings`, { method: 'PATCH', body, conversionId: id }),
  reorder: (id: string, problemIds: string[]) => request<ConversionDto>(`/conversions/${id}/order`, { method: 'PUT', body: { problemIds }, conversionId: id }),
  updateProblem: (id: string, problemId: string, body: UpdateProblemRequest) =>
    request<ProblemDto>(`/conversions/${id}/problems/${problemId}`, { method: 'PATCH', body, conversionId: id }),
  removeProblem: (id: string, problemId: string) => request<ConversionDto>(`/conversions/${id}/problems/${problemId}`, { method: 'DELETE', conversionId: id }),
  rewrite: (id: string, problemId: string, body: RewriteSectionRequest) =>
    request<RewriteSectionResponse>(`/conversions/${id}/problems/${problemId}/rewrite`, { body, conversionId: id }),
  suggestTests: (id: string, problemId: string, body: SuggestTestsRequest) =>
    request<SuggestTestsResponse>(`/conversions/${id}/problems/${problemId}/suggest-tests`, { body, conversionId: id }),
  export: (id: string, format: ExportFormat) => download(`/conversions/${id}/export/${format}`, id, `bo-de.${format}`),

  // Billing
  usage: () => request<UsageDto>('/billing/usage'),
  ledger: () => request<LedgerEntryDto[]>('/billing/ledger'),
  paymentMethods: () => request<{ methods: PaymentMethodDto[] }>('/billing/catalog').then((c) => c.methods),
  checkout: (body: CheckoutRequest) => request<CheckoutResponse>('/billing/checkout', { body }),
  orders: () => request<OrderDto[]>('/billing/orders'),
  order: (id: string) => request<OrderDto>(`/billing/orders/${id}`),
  workspace: () => request<WorkspaceDto | null>('/workspace'),
  updateWorkspace: (body: { name?: string; header?: string }) => request<WorkspaceDto>('/workspace', { method: 'PATCH', body }),
  invite: (email: string) => request<WorkspaceDto>('/workspace/members', { body: { email } }),
  removeMember: (email: string) => request<WorkspaceDto>(`/workspace/members/${encodeURIComponent(email)}`, { method: 'DELETE' }),

  // Growth
  visit: (body: VisitRequest) => request<void>('/growth/visit', { body }),
  consent: (body: ConsentRequest) => request<void>('/growth/consent', { body }),
  track: (visitorId: string, events: TrackEvent[]) => request<void>('/growth/events', { body: { visitorId, events } }),
  guestLead: (body: GuestLeadRequest) => request<void>('/growth/leads', { body }),
  contactSales: (body: ContactSalesRequest) => request<void>('/growth/contact-sales', { body }),
  rewards: () => request<RewardsDto>('/rewards'),
  survey: (body: SurveyRequest) => request<RewardResultDto>('/rewards/survey', { body }),
  feedback: (body: FeedbackRequest) => request<RewardResultDto>('/rewards/feedback', { body }),
  bugReport: (body: BugReportRequest) => request<RewardResultDto>('/rewards/bug-report', { body }),
  research: (body: ResearchSignupRequest) => request<RewardResultDto>('/rewards/research', { body }),

  // Admin
  leads: (offset: number, q: string) => request<Page<LeadDto>>(`/admin/leads?offset=${offset}&limit=50&q=${encodeURIComponent(q)}`),
  leadsCsvUrl: () => `${API_URL}/api/admin/leads.csv`,
  downloadLeads: async () => {
    const res = await fetch(`${API_URL}/api/admin/leads.csv`, { headers: headers(undefined, false) });
    if (!res.ok) throw await failure(res);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
  reviews: () => request<ReviewItemDto[]>('/admin/reviews'),
  decide: (id: string, body: ReviewDecisionRequest) => request<void>(`/admin/reviews/${id}`, { body }),
};
