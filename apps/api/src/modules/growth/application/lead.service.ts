import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ContactSalesRequest, GuestLeadRequest, LeadDto, Page } from '@agg/contracts';
import { Mailer } from '../../../shared/application/mailer.js';
import { RateLimiter } from '../../../shared/application/rate-limiter.js';
import { enforceRateLimit } from '../../../shared/application/rate-limit.js';
import type { Requester } from '../../../shared/application/requester.js';
import { Lead, type LeadInput } from '../domain/lead.js';
import { LeadRepository } from '../domain/repositories.js';

@Injectable()
export class LeadService {
  private readonly logger = new Logger(LeadService.name);
  private readonly salesInbox: string | null;

  constructor(
    private readonly leads: LeadRepository,
    private readonly mailer: Mailer,
    private readonly limiter: RateLimiter,
    config: ConfigService,
  ) {
    this.salesInbox = config.get<string>('SALES_NOTIFY_EMAIL') || null;
  }

  /** Merges a touch into the lead of that address (creates it the first time). */
  async upsert(input: LeadInput): Promise<Lead> {
    const existing = await this.leads.findByEmail(input.email.trim().toLowerCase());
    const lead = existing ?? Lead.capture(input);
    if (existing) existing.merge(input);
    await this.leads.save(lead);
    return lead;
  }

  /** A guest leaves an e-mail (to get tips and their result link). */
  async guestEmail(requester: Requester, body: GuestLeadRequest): Promise<void> {
    await enforceRateLimit(this.limiter, `lead:${requester.ipHash}`, 10, 3600);
    await this.upsert({
      email: body.email, source: 'GUEST_EMAIL', name: body.name, marketingConsent: body.marketingConsent,
      visitorId: requester.visitorId, userId: requester.kind === 'user' ? requester.userId : null,
      attributes: body.conversionId ? { lastConversionId: body.conversionId } : {},
    });
  }

  async contactSales(requester: Requester, body: ContactSalesRequest): Promise<void> {
    await enforceRateLimit(this.limiter, `sales:${requester.ipHash}`, 5, 3600);
    await this.upsert({
      email: body.email, source: 'CONTACT_SALES', name: body.name, phone: body.phone, organization: body.organization,
      marketingConsent: body.marketingConsent, visitorId: requester.visitorId,
      userId: requester.kind === 'user' ? requester.userId : null,
      attributes: {
        organizationType: body.organizationType,
        interest: body.interest,
        ...(body.seats ? { seats: String(body.seats) } : {}),
        ...(body.message ? { salesMessage: body.message } : {}),
      },
    });
    if (this.salesInbox) {
      await this.mailer.send({
        to: this.salesInbox,
        subject: `[Lead ${body.interest}] ${body.organization}`,
        text: `Tổ chức: ${body.organization} (${body.organizationType})\nNgười liên hệ: ${body.name}\nEmail: ${body.email}\n`
          + `Điện thoại: ${body.phone ?? '-'}\nSố người: ${body.seats ?? '-'}\n\n${body.message ?? ''}`,
      }).catch((e: unknown) => this.logger.warn(`Sales notification failed: ${(e as Error).message}`));
    }
  }

  async list(offset: number, limit: number, search: string | null): Promise<Page<LeadDto>> {
    const { items, total } = await this.leads.list(offset, limit, search);
    return { items: items.map(toLeadDto), total };
  }

  /** CSV for the sales team, only leads that agreed to be contacted for marketing unless `all`. */
  async csv(all: boolean): Promise<string> {
    const rows: string[][] = [['email', 'name', 'phone', 'organization', 'sources', 'marketing_consent', 'user_id', 'attributes', 'created_at', 'updated_at']];
    for (let offset = 0; ; offset += 500) {
      const { items } = await this.leads.list(offset, 500, null);
      for (const lead of items.map(toLeadDto)) {
        if (!all && !lead.marketingConsent) continue;
        rows.push([lead.email, lead.name ?? '', lead.phone ?? '', lead.organization ?? '', lead.sources.join('|'), String(lead.marketingConsent),
          lead.userId ?? '', JSON.stringify(lead.attributes), lead.createdAt, lead.updatedAt]);
      }
      if (items.length < 500) break;
    }
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
}

/** Quotes a cell, and neutralises formulas (=, +, -, @) that spreadsheets would execute. */
const csvCell = (value: string) => `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replace(/"/g, '""')}"`;

function toLeadDto(lead: Lead): LeadDto {
  const s = lead.snapshot();
  return {
    id: s.id, email: s.email, name: s.name, phone: s.phone, organization: s.organization, sources: s.sources,
    marketingConsent: s.marketingConsent, userId: s.userId, attributes: s.attributes,
    createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
  };
}
