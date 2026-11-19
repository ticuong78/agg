import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MvpExportFormats, type ExportFormat, type ExportFormatInfo } from '@agg/contracts';
import { isMvpMode } from '../../../shared/application/app-mode.js';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import type { Requester } from '../../../shared/application/requester.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import { ConversionExported } from '../conversion.events.js';
import { ConversionService } from './conversion.service.js';
import { ExporterRegistry, UsageGateway, type ExportedFile } from './ports.js';

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  { format: 'contest', label: 'Themis (.contest)', extension: '.contest', requiresAccount: false },
  { format: 'md', label: 'Markdown (.md)', extension: '.md', requiresAccount: false },
  { format: 'docx', label: 'Word (.docx)', extension: '.docx', requiresAccount: true },
  { format: 'doc', label: 'Word 97-2003 (.doc)', extension: '.doc', requiresAccount: true },
  { format: 'pdf', label: 'PDF (.pdf)', extension: '.pdf', requiresAccount: true },
];

/** Step 3: free for every format the tier allows. */
@Injectable()
export class ExportService {
  /** The formats this deployment offers: in MVP mode (GD-3) only the Themis contest. */
  private readonly offered: ExportFormatInfo[];

  constructor(
    private readonly conversions: ConversionService,
    private readonly exporters: ExporterRegistry,
    private readonly usage: UsageGateway,
    private readonly events: EventPublisher,
    config: ConfigService,
  ) {
    this.offered = isMvpMode(config) ? EXPORT_FORMATS.filter((f) => MvpExportFormats.includes(f.format)) : EXPORT_FORMATS;
  }

  formats(): ExportFormatInfo[] {
    return this.offered.map((f) => ({ ...f }));
  }

  async export(requester: Requester, id: string, accessKey: string | null, format: ExportFormat): Promise<ExportedFile> {
    if (!EXPORT_FORMATS.some((f) => f.format === format)) {
      throw DomainError.validation('export.unknown_format', 'Định dạng xuất không được hỗ trợ.');
    }
    // A known format this deployment does not offer is closed, like a closed route (GD-3).
    const info = this.offered.find((f) => f.format === format);
    if (!info) throw DomainError.notFound('feature.off', 'Không tìm thấy trang.');
    const conversion = await this.conversions.open(requester, id, accessKey);
    if (info.requiresAccount) {
      const profile = await this.usage.profile(requester);
      if (!profile.features.documentExports) {
        throw DomainError.paymentRequired('feature.document_exports', `Xuất ${info.label} cần đăng nhập (miễn phí).`, { action: 'signin' });
      }
    }
    conversion.assertReady();
    const snapshot = conversion.snapshot();
    const file = await this.exporters.get(format).export({ settings: snapshot.settings, problems: snapshot.problems });
    await this.events.publish([new ConversionExported(id, conversion.ownerUserId, requester.visitorId, format)]);
    return file;
  }
}
