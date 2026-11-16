import type { DomainEvent } from '../../shared/domain/aggregate-root.js';

export const CONVERSION_COMPLETED = 'conversion.completed';
export const CONVERSION_EXPORTED = 'conversion.exported';

/** Growth uses it to qualify referrals (a referred teacher actually converted something) and for funnel stats. */
export class ConversionCompleted implements DomainEvent {
  readonly name = CONVERSION_COMPLETED;
  readonly occurredAt = new Date();
  constructor(
    readonly conversionId: string,
    readonly ownerUserId: string | null,
    readonly visitorId: string | null,
    readonly problemCount: number,
  ) {}
}

export class ConversionExported implements DomainEvent {
  readonly name = CONVERSION_EXPORTED;
  readonly occurredAt = new Date();
  constructor(
    readonly conversionId: string,
    readonly ownerUserId: string | null,
    readonly visitorId: string | null,
    readonly format: string,
  ) {}
}
