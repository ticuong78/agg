import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ConversionStatus, ExtractionEngine } from '@agg/contracts';
import { Column, Entity, Index, LessThanOrEqual, PrimaryColumn, type Repository } from 'typeorm';
import type { ContestSettings } from '../domain/contest-settings.js';
import { Conversion, type SourceInfo } from '../domain/conversion.js';
import type { ProblemState } from '../domain/problem.js';
import { ConversionRepository } from '../domain/repositories.js';

/** One row per conversion: the aggregate is stored whole (problems and tests as JSON), it is always loaded whole. */
@Entity('conversions')
export class ConversionOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Index() @Column({ name: 'owner_user_id', type: 'uuid', nullable: true }) ownerUserId: string | null;
  @Column({ name: 'guest_key_hash', type: 'varchar', length: 64, nullable: true }) guestKeyHash: string | null;
  @Column({ name: 'visitor_id', type: 'uuid', nullable: true }) visitorId: string | null;
  @Column({ type: 'varchar', length: 12 }) status: ConversionStatus;
  @Column({ type: 'varchar', length: 8, nullable: true }) engine: ExtractionEngine | null;
  @Column({ type: 'jsonb' }) sources: SourceInfo[];
  @Column({ type: 'jsonb' }) problems: ProblemState[];
  @Column({ type: 'jsonb' }) settings: ContestSettings;
  @Column({ type: 'text', nullable: true }) failure: string | null;
  @Column({ name: 'credits_charged', type: 'int', default: 0 }) creditsCharged: number;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @Index() @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt: Date;
}

@Injectable()
export class TypeOrmConversionRepository extends ConversionRepository {
  constructor(@InjectRepository(ConversionOrmEntity) private readonly repo: Repository<ConversionOrmEntity>) {
    super();
  }

  async findById(id: string) {
    const row = await this.repo.findOneBy({ id });
    return row ? Conversion.restore({ ...row }) : null;
  }

  async listByOwner(ownerUserId: string, limit: number) {
    const rows = await this.repo.find({ where: { ownerUserId }, order: { createdAt: 'DESC' }, take: limit });
    return rows.map((row) => Conversion.restore({ ...row }));
  }

  async insert(conversion: Conversion) {
    await this.repo.insert(withoutNul(conversion.snapshot()) as never);
  }

  async save(conversion: Conversion) {
    // UPDATE, never upsert: if the row is gone, nothing is written (GD-7).
    const { id, ...fields } = withoutNul(conversion.snapshot());
    await this.repo.update({ id }, fields as never);
  }

  async delete(id: string) {
    await this.repo.delete({ id });
  }

  async deleteByOwner(ownerUserId: string) {
    await this.repo.delete({ ownerUserId });
  }

  async deleteExpired(now: Date) {
    return (await this.repo.delete({ expiresAt: LessThanOrEqual(now) })).affected ?? 0;
  }

  async failInterrupted(reason: string) {
    return (await this.repo.update({ status: 'PROCESSING' }, { status: 'FAILED', failure: reason })).affected ?? 0;
  }
}

/**
 * PostgreSQL text and jsonb cannot hold U+0000. Exam text read from a PDF, or sent by a client, may contain it, and
 * the failed write would then be logged with its parameters. Removed from every string before a set is stored.
 */
function withoutNul<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\u0000/g, '') as T;
  if (Array.isArray(value)) return value.map(withoutNul) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutNul(v)])) as T;
  }
  return value;
}
