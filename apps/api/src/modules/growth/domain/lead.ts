import type { LeadSource } from '@agg/contracts';
import { newId } from '../../../shared/domain/aggregate-root.js';
import { Email } from '../../../shared/domain/email.js';

export interface LeadState {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  organization: string | null;
  sources: LeadSource[];
  marketingConsent: boolean;
  consentAt: Date | null;
  userId: string | null;
  visitorIds: string[];
  /** Answers collected along the way (survey, sales form): role, province, students... */
  attributes: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadInput {
  email: string;
  source: LeadSource;
  name?: string | null;
  phone?: string | null;
  organization?: string | null;
  /** undefined = this touch said nothing about consent; the previous answer stays. */
  marketingConsent?: boolean;
  userId?: string | null;
  visitorId?: string | null;
  attributes?: Record<string, string>;
}

const clean = (v: string | null | undefined, max: number) => {
  const value = v?.trim();
  return value ? value.slice(0, max) : null;
};

/**
 * Aggregate: one prospective customer, keyed by e-mail. Every touch (guest e-mail, sign-up, survey, sales form)
 * merges into it, so sales sees one record per person with where they came from.
 */
export class Lead {
  private constructor(private state: LeadState) {}

  static capture(input: LeadInput, now = new Date()): Lead {
    const lead = new Lead({
      id: newId(), email: Email.of(input.email).value, name: null, phone: null, organization: null, sources: [],
      marketingConsent: false, consentAt: null, userId: null, visitorIds: [], attributes: {}, createdAt: now, updatedAt: now,
    });
    lead.merge(input, now);
    return lead;
  }

  static restore(state: LeadState): Lead {
    return new Lead({ ...state, sources: [...state.sources], visitorIds: [...state.visitorIds], attributes: { ...state.attributes } });
  }

  get email(): string { return this.state.email; }
  snapshot(): LeadState { return { ...this.state }; }

  merge(input: LeadInput, now = new Date()): void {
    const s = this.state;
    s.name = clean(input.name, 120) ?? s.name;
    s.phone = clean(input.phone, 30) ?? s.phone;
    s.organization = clean(input.organization, 200) ?? s.organization;
    if (!s.sources.includes(input.source)) s.sources.push(input.source);
    if (input.marketingConsent !== undefined && input.marketingConsent !== s.marketingConsent) {
      s.marketingConsent = input.marketingConsent;
      s.consentAt = now;
    }
    if (input.userId) s.userId = input.userId;
    if (input.visitorId && !s.visitorIds.includes(input.visitorId)) s.visitorIds = [...s.visitorIds, input.visitorId].slice(-10);
    for (const [key, value] of Object.entries(input.attributes ?? {})) {
      const v = clean(value, 1000);
      if (v) s.attributes[key.slice(0, 40)] = v;
    }
    s.updatedAt = now;
  }
}
