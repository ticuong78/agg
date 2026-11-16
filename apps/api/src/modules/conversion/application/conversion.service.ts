import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type {
  ConversionDto, ConversionSummaryDto, CreateConversionResponse, ProblemDto, UpdateProblemRequest, UpdateSettingsRequest,
} from '@agg/contracts';
import { EventPublisher } from '../../../shared/application/event-publisher.js';
import type { Requester, UserRequester } from '../../../shared/application/requester.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { stripExternalLinks } from '../../../shared/domain/external-links.js';
import { Conversion } from '../domain/conversion.js';
import { documentText, type ExamDocument } from '../domain/exam-document.js';
import { ExamParser } from '../domain/exam-parser.js';
import type { ProblemDraft } from '../domain/problem-draft.js';
import { ConversionRepository } from '../domain/repositories.js';
import { classifySource, imageMediaType, type SourceFile } from '../domain/source-file.js';
import { ConversionCompleted } from '../conversion.events.js';
import { toConversionDto, toProblemDto, toSummaryDto } from './conversion.mapper.js';
import { DocumentReader, JobQueue, SmartReader, UsageGateway, type ReadSource, type UsageProfile } from './ports.js';

const PASTED_NAME = 'Nội dung đã dán.txt';
const MAX_PASTED_CHARS = 200_000;
/** Below this many characters per page, a PDF is treated as scanned. */
const SCANNED_CHARS_PER_PAGE = 40;

/** Step 1 (upload + extraction) and the plain edits of step 2. */
@Injectable()
export class ConversionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ConversionService.name);
  private readonly parser = new ExamParser();

  constructor(
    private readonly conversions: ConversionRepository,
    private readonly reader: DocumentReader,
    private readonly smartReader: SmartReader,
    private readonly usage: UsageGateway,
    private readonly jobs: JobQueue,
    private readonly events: EventPublisher,
  ) {}

  async onApplicationBootstrap() {
    const failed = await this.conversions.failInterrupted('Máy chủ đã khởi động lại trong lúc xử lý. Tài liệu gốc không được lưu, vui lòng tải lên lại.');
    if (failed) this.logger.warn(`${failed} conversions interrupted by a restart were marked failed`);
  }

  // ---------- Step 1 ----------

  async createFromFiles(requester: Requester, files: SourceFile[]): Promise<CreateConversionResponse> {
    const profile = await this.usage.profile(requester);
    assert(files.length > 0, 'conversion.no_source', 'Hãy chọn ít nhất một tệp.');
    if (files.length > profile.limits.maxFilesPerUpload) {
      throw upgrade('limit.files_per_upload', requester,
        `Gói hiện tại cho tải tối đa ${profile.limits.maxFilesPerUpload} tệp mỗi lần.`);
    }
    for (const file of files) {
      if (file.buffer.length > profile.limits.maxFileMb * 1024 * 1024) {
        throw upgrade('limit.file_size', requester, `"${file.name}" lớn hơn ${profile.limits.maxFileMb} MB, giới hạn của gói hiện tại.`);
      }
    }
    const sources = await Promise.all(files.map((file) => this.readSource(file)));
    return this.start(requester, profile, sources);
  }

  async createFromText(requester: Requester, text: string): Promise<CreateConversionResponse> {
    const value = text.replace(/\r\n?/g, '\n').trim();
    assert(value, 'conversion.empty_text', 'Hãy dán nội dung đề vào ô trước.');
    assert(value.length <= MAX_PASTED_CHARS, 'conversion.text_too_long', 'Nội dung dài quá 200.000 ký tự. Hãy chia thành nhiều lần.');
    const profile = await this.usage.profile(requester);
    const document: ExamDocument = {
      fileName: PASTED_NAME,
      blocks: value.split('\n').filter((l) => l.trim()).map((line) => ({ kind: 'paragraph', text: line })),
    };
    const file = { name: PASTED_NAME, buffer: Buffer.from(value, 'utf8') };
    return this.start(requester, profile, [{ file, kind: 'PASTED', document, pages: null, scanned: false, mediaType: null }]);
  }

  private async readSource(file: SourceFile): Promise<ReadSource> {
    const kind = classifySource(file);
    if (kind === 'IMAGE') return { file, kind, document: null, pages: 1, scanned: false, mediaType: imageMediaType(file.buffer) };
    const { document, pages } = await this.reader.read(file, kind).catch((error: unknown) => {
      this.logger.warn(`Could not read the text layer of a ${kind} upload: ${(error as Error).message}`);
      return { document: null, pages: null };
    });
    const chars = document ? documentText(document).replace(/\s+/g, '').length : 0;
    const scanned = kind === 'PDF' && chars < SCANNED_CHARS_PER_PAGE * Math.max(1, pages ?? 1);
    if (!scanned && chars === 0) {
      throw DomainError.validation('source.no_text', `Không đọc được chữ nào trong "${file.name}". Hãy kiểm tra tệp hoặc dán nội dung đề.`);
    }
    return { file, kind, document, pages, scanned, mediaType: null };
  }

  /** Sources that need a visual read, and how many image pages they count for. */
  private imagePages(sources: ReadSource[]): number {
    return sources.reduce((n, s) => n + (s.kind === 'IMAGE' ? 1 : s.scanned ? Math.max(1, s.pages ?? 1) : 0), 0);
  }

  private async start(requester: Requester, profile: UsageProfile, sources: ReadSource[]): Promise<CreateConversionResponse> {
    const imagePages = this.imagePages(sources);
    if (imagePages > 0) {
      if (!profile.features.images) {
        throw upgrade('feature.images', requester, 'Đọc đề từ ảnh hoặc PDF dạng scan cần đăng nhập (miễn phí).');
      }
      if (!this.smartReader.available) {
        throw DomainError.validation('ai.unavailable', 'Tính năng đọc ảnh tạm thời chưa sẵn sàng. Hãy dùng tệp PDF có chữ, Word hoặc dán văn bản.');
      }
      await this.usage.assertCanAfford(requester, 'EXTRACT_IMAGE_PAGE', imagePages);
    }
    await this.usage.consumeConversion(requester, profile);

    const { conversion, accessKey } = Conversion.start({
      requester,
      sources: sources.map((s) => ({ name: s.file.name, kind: s.kind, sizeBytes: s.file.buffer.length, pages: s.pages })),
      retentionDays: profile.limits.retentionDays,
    });
    await this.conversions.save(conversion);
    this.jobs.enqueue(() => this.extract(conversion.id, requester, profile, sources, imagePages), profile.features.priorityQueue);
    return { conversion: toConversionDto(conversion), accessKey };
  }

  /** Background job: AI read with the rule-based parser as fallback, then charge what the AI actually read. */
  private async extract(id: string, requester: Requester, profile: UsageProfile, sources: ReadSource[], imagePages: number) {
    const conversion = await this.conversions.findById(id);
    if (!conversion) return;
    const mode = requester.kind === 'user' ? 'account' : 'guest';
    const drafts: ProblemDraft[] = [];
    let usedAi = false;
    let failures = 0;
    try {
      for (const source of sources) {
        const needsVision = source.kind === 'IMAGE' || source.scanned;
        if (this.smartReader.available) {
          try {
            drafts.push(...(await this.smartReader.read(source, needsVision ? 'account' : mode)));
            usedAi = true;
            continue;
          } catch (error) {
            this.logger.warn(`AI read failed (${source.kind}), falling back: ${(error as Error).message}`);
          }
        }
        if (source.document && !needsVision) drafts.push(...this.parser.parse(source.document));
        else failures++;
      }
      if (!drafts.length) {
        conversion.fail(failures
          ? 'Không đọc được nội dung tài liệu. Hãy thử lại sau ít phút, hoặc dùng tệp PDF có chữ / dán văn bản.'
          : 'Không tìm thấy bài tập nào trong tài liệu.');
      } else {
        let credits = 0;
        if (imagePages > 0 && usedAi) {
          await this.usage.charge(requester, 'EXTRACT_IMAGE_PAGE', imagePages, conversion.id);
          credits = imagePages;
        }
        conversion.complete(usedAi ? 'AI' : 'BASIC', drafts.map(clean), profile.limits.maxProblems, credits);
      }
    } catch (error) {
      this.logger.error(`Extraction failed: ${(error as Error).message}`);
      conversion.fail('Xử lý tài liệu không thành công. Vui lòng thử lại.');
    }
    await this.conversions.save(conversion);
    if (conversion.status === 'READY') {
      await this.events.publish([new ConversionCompleted(conversion.id, conversion.ownerUserId, requester.visitorId, conversion.problemList.length)]);
    }
  }

  // ---------- Reading and editing ----------

  async get(requester: Requester, id: string, accessKey: string | null): Promise<ConversionDto> {
    return toConversionDto(await this.open(requester, id, accessKey));
  }

  async list(requester: UserRequester): Promise<ConversionSummaryDto[]> {
    return (await this.conversions.listByOwner(requester.userId, 100)).filter((c) => !c.isExpired()).map(toSummaryDto);
  }

  /** A guest who signed in takes their conversion along. */
  async claim(requester: UserRequester, id: string, accessKey: string | null): Promise<ConversionDto> {
    const conversion = await this.conversions.findById(id);
    if (!conversion || conversion.isExpired()) throw notFound();
    const profile = await this.usage.profile(requester);
    conversion.claim(requester.userId, accessKey, profile.limits.retentionDays);
    await this.conversions.save(conversion);
    return toConversionDto(conversion);
  }

  async updateProblem(requester: Requester, id: string, accessKey: string | null, problemId: string, body: UpdateProblemRequest): Promise<ProblemDto> {
    const conversion = await this.open(requester, id, accessKey);
    const problem = conversion.updateProblem(problemId, body);
    await this.conversions.save(conversion);
    return toProblemDto(problem);
  }

  async removeProblem(requester: Requester, id: string, accessKey: string | null, problemId: string): Promise<ConversionDto> {
    const conversion = await this.open(requester, id, accessKey);
    conversion.removeProblem(problemId);
    await this.conversions.save(conversion);
    return toConversionDto(conversion);
  }

  async reorder(requester: Requester, id: string, accessKey: string | null, problemIds: string[]): Promise<ConversionDto> {
    const conversion = await this.open(requester, id, accessKey);
    conversion.reorder(problemIds);
    await this.conversions.save(conversion);
    return toConversionDto(conversion);
  }

  async updateSettings(requester: Requester, id: string, accessKey: string | null, body: UpdateSettingsRequest): Promise<ConversionDto> {
    const conversion = await this.open(requester, id, accessKey);
    const profile = await this.usage.profile(requester);
    conversion.updateSettings(body, profile.features.branding);
    await this.conversions.save(conversion);
    return toConversionDto(conversion);
  }

  async delete(requester: Requester, id: string, accessKey: string | null): Promise<void> {
    await this.open(requester, id, accessKey);
    await this.conversions.delete(id);
  }

  /** Loads a conversion the requester may open; anything else looks like it does not exist. */
  async open(requester: Requester, id: string, accessKey: string | null): Promise<Conversion> {
    const conversion = await this.conversions.findById(id);
    if (!conversion || conversion.isExpired() || !conversion.canBeOpenedBy(requester, accessKey)) throw notFound();
    return conversion;
  }

  async save(conversion: Conversion): Promise<void> {
    await this.conversions.save(conversion);
  }
}

/** Links to other places (original problem elsewhere, group invitations) never reach the statements. */
function clean(draft: ProblemDraft): ProblemDraft {
  const strip = (text: string) => stripExternalLinks(text).text;
  return {
    ...draft,
    // "Tổng hai số (SUM.CPP)": the file name is the task code, not part of the title.
    title: draft.title.replace(/\s*[([]\s*[A-Za-z][A-Za-z0-9_]*\.(?:cpp|pas|py|c|java|inp|out|\*)\s*[)\]]\s*/gi, ' ').trim() || draft.title,
    statement: strip(draft.statement),
    inputFormat: strip(draft.inputFormat),
    outputFormat: strip(draft.outputFormat),
    constraints: strip(draft.constraints),
    warnings: draft.warnings.filter((w) => !/https?:\/\/|www\.|đường dẫn|liên kết/i.test(w)),
  };
}

const notFound = () => DomainError.notFound('conversion.not_found', 'Không tìm thấy bộ đề hoặc bộ đề đã hết hạn.');

/** A limit of the current tier: guests are sent to sign in, accounts to the pricing page. */
function upgrade(code: string, requester: Requester, message: string): DomainError {
  return DomainError.paymentRequired(code, message, { action: requester.kind === 'guest' ? 'signin' : 'upgrade' });
}
