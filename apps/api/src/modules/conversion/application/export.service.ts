import { Injectable } from '@nestjs/common';
import type { ExportFormat, ExportFormatInfo } from '@agg/contracts';
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
  constructor(
    private readonly conversions: ConversionService,
    private readonly exporters: ExporterRegistry,
    private readonly usage: UsageGateway,
    private readonly events: EventPublisher,
  ) {}

  async export(requester: Requester, id: string, accessKey: string | null, format: ExportFormat): Promise<ExportedFile> {
    const info = EXPORT_FORMATS.find((f) => f.format === format);
    if (!info) throw DomainError.validation('export.unknown_format', 'Định dạng xuất không được hỗ trợ.');
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
