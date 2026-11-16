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

  async save(conversion: Conversion) {
    await this.repo.save(this.repo.create(conversion.snapshot()));
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
