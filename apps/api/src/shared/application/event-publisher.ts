import type { DomainEvent } from '../domain/aggregate-root.js';

/** Port: publishes domain events after the aggregate that raised them was saved. */
export abstract class EventPublisher {
  abstract publish(events: DomainEvent[]): Promise<void>;
}
