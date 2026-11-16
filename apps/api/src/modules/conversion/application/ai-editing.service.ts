import { Injectable, Logger } from '@nestjs/common';
import type { RewriteSectionRequest, RewriteSectionResponse, SuggestTestsRequest, SuggestTestsResponse } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { stripExternalLinks } from '../../../shared/domain/external-links.js';
import { ConversionService } from './conversion.service.js';
import { SectionWriter, TestSuggester, UsageGateway } from './ports.js';

export const MAX_SUGGESTED_TESTS = 10;

/** Step 2 with AI: rewrite a section, suggest tests. Charged only when the AI answered. */
@Injectable()
export class AiEditingService {
  private readonly logger = new Logger(AiEditingService.name);

  constructor(
    private readonly conversions: ConversionService,
    private readonly writer: SectionWriter,
    private readonly suggester: TestSuggester,
    private readonly usage: UsageGateway,
  ) {}

  async rewrite(requester: Requester, id: string, accessKey: string | null, problemId: string, body: RewriteSectionRequest): Promise<RewriteSectionResponse> {
    const conversion = await this.conversions.open(requester, id, accessKey);
    conversion.assertReady();
    const problem = conversion.problem(problemId);
    const profile = await this.usage.profile(requester);
    if (!profile.features.rewrite) throw locked(requester, 'Viết lại đề bằng AI cần đăng nhập (miễn phí).');
    if (!this.writer.available) throw unavailable();
    await this.usage.assertCanAfford(requester, 'REWRITE_SECTION', 1);

    const result = await this.writer
      .write(body.section, problem.snapshot(), conversion.settings.ioMode, body.instruction?.trim() || null)
      .catch((error: unknown) => {
        this.logger.warn(`Rewrite failed: ${(error as Error).message}`);
        throw DomainError.validation('ai.failed', 'AI chưa viết lại được mục này. Bạn không bị trừ credit, hãy thử lại.');
      });
    const text = body.section === 'title'
      ? result.text.replace(/\s+/g, ' ').trim().slice(0, 200)
      : stripExternalLinks(result.text).text;
    const creditsLeft = await this.usage.charge(requester, 'REWRITE_SECTION', 1, `${id}:${problemId}:${body.section}`);
    conversion.charged(1);
    await this.conversions.save(conversion);
    // The rewrite is a proposal: the teacher accepts it with a normal update, so the problem is not changed here.
    return { section: body.section, text, notes: result.notes, creditsLeft };
  }

  async suggestTests(requester: Requester, id: string, accessKey: string | null, problemId: string, body: SuggestTestsRequest): Promise<SuggestTestsResponse> {
    assert(Number.isInteger(body.count) && body.count >= 1 && body.count <= MAX_SUGGESTED_TESTS, 'tests.invalid_count',
      `Mỗi lần gợi ý từ 1 đến ${MAX_SUGGESTED_TESTS} test.`);
    const conversion = await this.conversions.open(requester, id, accessKey);
    conversion.assertReady();
    const problem = conversion.problem(problemId);
    const profile = await this.usage.profile(requester);
    if (!profile.features.testSuggestions) throw locked(requester, 'Gợi ý test bằng AI cần đăng nhập (miễn phí).');
    if (!this.suggester.available) throw unavailable();
    await this.usage.assertCanAfford(requester, 'SUGGEST_TESTS', 1);

    const result = await this.suggester
      .suggest({ problem: problem.snapshot(), count: body.count, focus: body.focus?.trim() || null })
      .catch((error: unknown) => {
        this.logger.warn(`Test suggestions failed: ${(error as Error).message}`);
        throw DomainError.validation('ai.failed', 'AI chưa gợi ý được test cho bài này. Bạn không bị trừ credit, hãy thử lại.');
      });
    const creditsLeft = await this.usage.charge(requester, 'SUGGEST_TESTS', 1, `${id}:${problemId}:tests`);
    conversion.charged(1);
    await this.conversions.save(conversion);
    return { ...result, creditsLeft };
  }
}

const locked = (requester: Requester, message: string) =>
  DomainError.paymentRequired('feature.locked', message, { action: requester.kind === 'guest' ? 'signin' : 'upgrade' });
const unavailable = () => DomainError.validation('ai.unavailable', 'Tính năng AI tạm thời chưa sẵn sàng. Vui lòng thử lại sau.');
