import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventPublisher } from '../application/event-publisher.js';
import type { DomainEvent } from '../domain/aggregate-root.js';

@Injectable()
export class NestEventPublisher extends EventPublisher {
  constructor(private readonly emitter: EventEmitter2) {
    super();
  }

  async publish(events: DomainEvent[]): Promise<void> {
    // Handlers run after the emitting transaction; a failing reaction must not undo what already happened.
    for (const event of events) await this.emitter.emitAsync(event.name, event);
  }
}
