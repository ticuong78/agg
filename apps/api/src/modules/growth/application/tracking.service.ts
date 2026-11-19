import { Injectable } from '@nestjs/common';
import { Retention } from '@agg/contracts';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CONVERSION_COMPLETED, CONVERSION_EXPORTED, type ConversionCompleted, type ConversionExported,
} from '../../conversion/conversion.events.js';
import type { ConsentRequest, TrackEventsRequest, VisitRequest } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import { AnalyticsEventRepository, VisitorRepository, type AnalyticsEvent } from '../domain/repositories.js';
import { Visitor } from '../domain/visitor.js';

/** Product events kept without analytics consent: they are needed to run the service (quota, funnel totals), carry no profile. */
export const ESSENTIAL_EVENTS = new Set(['conversion_completed', 'export_downloaded']);
const MAX_EVENTS_PER_CALL = 30;

/**
 * First-party visitor records and events. Analytics (page views, clicks) are stored only after the visitor agreed
 * in the consent banner; without it only the visitor row (attribution, needed for the guest allowance) exists.
 */
@Injectable()
export class TrackingService {
  constructor(
    private readonly visitors: VisitorRepository,
    private readonly events: AnalyticsEventRepository,
  ) {}

  async visit(requester: Requester, body: VisitRequest, context: { userAgent?: string; country?: string }): Promise<void> {
    const existing = await this.visitors.find(body.visitorId);
    const visitor = existing ?? Visitor.first(body.visitorId, {
      landingPath: body.landingPath,
      referrer: body.referrer ?? null,
      utmSource: body.utmSource ?? null,
      utmMedium: body.utmMedium ?? null,
      utmCampaign: body.utmCampaign ?? null,
    }, { ...context, language: body.language, ipHash: requester.ipHash });
    if (existing) existing.seenAgain(requester.ipHash);
    if (requester.kind === 'user') visitor.linkUser(requester.userId);
    await this.visitors.save(visitor);
  }

  async consent(requester: Requester, body: ConsentRequest): Promise<void> {
    const visitor = (await this.visitors.find(body.visitorId))
      ?? Visitor.first(body.visitorId, { landingPath: '/', referrer: null, utmSource: null, utmMedium: null, utmCampaign: null }, { ipHash: requester.ipHash });
    visitor.consent(body.analytics, body.marketing);
    if (requester.kind === 'user') visitor.linkUser(requester.userId);
    await this.visitors.save(visitor);
  }

  async track(requester: Requester, body: TrackEventsRequest): Promise<void> {
    const visitor = await this.visitors.find(body.visitorId);
    const consented = visitor?.analyticsConsent ?? false;
    const now = new Date();
    const kept: AnalyticsEvent[] = body.events
      .slice(0, MAX_EVENTS_PER_CALL)
      .filter((e) => consented || ESSENTIAL_EVENTS.has(e.name))
      .map((e) => ({
        visitorId: consented ? body.visitorId : null,
        userId: consented && requester.kind === 'user' ? requester.userId : null,
        name: e.name.slice(0, 60),
        path: e.path?.slice(0, 300) ?? null,
        props: Object.fromEntries(Object.entries(e.props ?? {}).slice(0, 20).map(([k, v]) => [k.slice(0, 40), typeof v === 'string' ? v.slice(0, 200) : v])),
        at: now,
      }));
    if (kept.length) await this.events.append(kept);
  }

  /** Retention promised by the privacy policy (Retention.analyticsDays, GD-7): analytics and visitor records. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - Retention.analyticsDays * 86_400_000);
    await this.events.deleteOlderThan(cutoff);
    await this.visitors.deleteNotSeenSince(cutoff);
  }

  /** Funnel totals (no profile: neither visitor nor account is stored with them). */
  @OnEvent(CONVERSION_COMPLETED, { async: true, promisify: true })
  async onCompleted(event: ConversionCompleted): Promise<void> {
    await this.events.append([{ visitorId: null, userId: null, name: 'conversion_completed', path: null, props: { problems: event.problemCount, account: !!event.ownerUserId }, at: new Date() }]);
  }

  @OnEvent(CONVERSION_EXPORTED, { async: true, promisify: true })
  async onExported(event: ConversionExported): Promise<void> {
    await this.events.append([{ visitorId: null, userId: null, name: 'export_downloaded', path: null, props: { format: event.format, account: !!event.ownerUserId }, at: new Date() }]);
  }
}
