import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ACCOUNT_DELETED, type AccountDeleted } from '../../identity/identity.events.js';
import { ConversionRepository } from '../domain/repositories.js';

/** A deleted account takes its conversions with it. */
@Injectable()
export class ConversionErasure {
  constructor(private readonly conversions: ConversionRepository) {}

  @OnEvent(ACCOUNT_DELETED, { async: true, promisify: true })
  async erase(event: AccountDeleted): Promise<void> {
    await this.conversions.deleteByOwner(event.userId);
  }
}
