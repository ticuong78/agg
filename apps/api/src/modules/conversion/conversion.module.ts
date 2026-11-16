import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingModule } from '../billing/billing.module.js';
import { AiEditingService } from './application/ai-editing.service.js';
import { ConversionService } from './application/conversion.service.js';
import { ExportService } from './application/export.service.js';
import {
  DocumentReader, ExporterRegistry, JobQueue, SectionWriter, SmartReader, TestSuggester, UsageGateway,
} from './application/ports.js';
import { RetentionSweeper } from './application/retention.sweeper.js';
import { ConversionErasure } from './application/account-erasure.js';
import { ConversionRepository } from './domain/repositories.js';
import { BillingFacadeGateway } from './infrastructure/billing.gateway.js';
import { ClaudeSectionWriter } from './infrastructure/claude-section-writer.js';
import { ClaudeSmartReader } from './infrastructure/claude-smart-reader.js';
import { ClaudeTestSuggester } from './infrastructure/claude-test-suggester.js';
import { TextLayerReader } from './infrastructure/document-reader.js';
import { DefaultExporterRegistry, EXPORTERS } from './infrastructure/exporters/registry.js';
import { InProcessJobQueue } from './infrastructure/in-process-job-queue.js';
import { ConversionOrmEntity, TypeOrmConversionRepository } from './infrastructure/persistence.js';
import { ConversionsController } from './presentation/conversions.controller.js';

@Module({
  imports: [BillingModule, TypeOrmModule.forFeature([ConversionOrmEntity])],
  controllers: [ConversionsController],
  providers: [
    ConversionService,
    AiEditingService,
    ExportService,
    RetentionSweeper,
    ConversionErasure,
    ...EXPORTERS,
    { provide: ExporterRegistry, useClass: DefaultExporterRegistry },
    { provide: ConversionRepository, useClass: TypeOrmConversionRepository },
    { provide: DocumentReader, useClass: TextLayerReader },
    { provide: SmartReader, useClass: ClaudeSmartReader },
    { provide: SectionWriter, useClass: ClaudeSectionWriter },
    { provide: TestSuggester, useClass: ClaudeTestSuggester },
    { provide: UsageGateway, useClass: BillingFacadeGateway },
    { provide: JobQueue, useClass: InProcessJobQueue },
  ],
})
export class ConversionModule {}
