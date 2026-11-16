import type { ConversionStatus, ExtractionEngine, SourceKind } from '@agg/contracts';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Requester } from '../../../shared/application/requester.js';
import { addDays, AggregateRoot, newId } from '../../../shared/domain/aggregate-root.js';
import { assert, DomainError } from '../../../shared/domain/domain-error.js';
import { changeSettings, defaultSettings, type ContestSettings } from './contest-settings.js';
import { Problem, type ProblemChanges, type ProblemState } from './problem.js';
import type { ProblemDraft } from './problem-draft.js';
import { TaskCode } from './task-code.js';
import type { TestCaseState } from './test-case.js';

export interface SourceInfo {
  name: string;
  kind: SourceKind;
  sizeBytes: number;
  pages: number | null;
}

export interface ConversionState {
  id: string;
  ownerUserId: string | null;
  /** Hash of the guest's access key; null once an account owns the conversion. */
  guestKeyHash: string | null;
  visitorId: string | null;
  status: ConversionStatus;
  engine: ExtractionEngine | null;
  sources: SourceInfo[];
  problems: ProblemState[];
  settings: ContestSettings;
  failure: string | null;
  creditsCharged: number;
  createdAt: Date;
  expiresAt: Date;
}

export const hashAccessKey = (key: string): string => createHash('sha256').update(key).digest('hex');

/**
 * Aggregate: one upload turned into a structured set of problems, edited in step 2, exported in step 3.
 * It holds only the structured result; the uploaded files themselves are never stored.
 */
export class Conversion extends AggregateRoot {
  private problems: Problem[];

  private constructor(private state: ConversionState) {
    super(state.id);
    this.problems = state.problems.map(Problem.restore);
  }

  /** A guest gets a secret key (returned once) to reopen their conversion; an account owns it outright. */
  static start(input: {
    requester: Requester;
    sources: SourceInfo[];
    retentionDays: number;
    now?: Date;
  }): { conversion: Conversion; accessKey: string | null } {
    assert(input.sources.length > 0, 'conversion.no_source', 'Hãy chọn ít nhất một tệp hoặc dán nội dung đề.');
    const now = input.now ?? new Date();
    const accessKey = input.requester.kind === 'guest' ? randomBytes(24).toString('base64url') : null;
    const firstName = input.sources[0].name.replace(/\.[^.]+$/, '');
    const conversion = new Conversion({
      id: newId(),
      ownerUserId: input.requester.kind === 'user' ? input.requester.userId : null,
      guestKeyHash: accessKey ? hashAccessKey(accessKey) : null,
      visitorId: input.requester.visitorId,
      status: 'PROCESSING',
      engine: null,
      sources: input.sources,
      problems: [],
      settings: defaultSettings(firstName),
      failure: null,
      creditsCharged: 0,
      createdAt: now,
      expiresAt: addDays(now, input.retentionDays),
    });
    return { conversion, accessKey };
  }

  static restore(state: ConversionState): Conversion {
    return new Conversion({ ...state });
  }

  get status(): ConversionStatus { return this.state.status; }
  get ownerUserId(): string | null { return this.state.ownerUserId; }
  get settings(): ContestSettings { return this.state.settings; }
  get sources(): readonly SourceInfo[] { return this.state.sources; }
  get expiresAt(): Date { return this.state.expiresAt; }
  get problemList(): readonly Problem[] { return this.problems; }

  snapshot(): ConversionState {
    return { ...this.state, problems: this.problems.map((p) => p.snapshot()) };
  }

  // ---------- Access ----------

  /** Accounts open what they own; guests need the key they were given. */
  canBeOpenedBy(requester: Requester, accessKey: string | null): boolean {
    if (requester.kind === 'user' && this.state.ownerUserId === requester.userId) return true;
    return this.keyMatches(accessKey);
  }

  /** A guest who signs in keeps their work: the conversion moves to the account and gets the account's retention. */
  claim(userId: string, accessKey: string | null, retentionDays: number): void {
    if (this.state.ownerUserId === userId) return;
    if (this.state.ownerUserId || !this.keyMatches(accessKey)) {
      throw DomainError.notFound('conversion.not_found', 'Không tìm thấy bộ đề hoặc bộ đề đã hết hạn.');
    }
    this.state.ownerUserId = userId;
    this.state.guestKeyHash = null;
    this.state.expiresAt = addDays(this.state.createdAt, retentionDays);
  }

  private keyMatches(accessKey: string | null): boolean {
    if (!accessKey || !this.state.guestKeyHash) return false;
    const a = Buffer.from(hashAccessKey(accessKey), 'hex');
    const b = Buffer.from(this.state.guestKeyHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  isExpired(now = new Date()): boolean {
    return this.state.expiresAt <= now;
  }

  // ---------- Extraction ----------

  complete(engine: ExtractionEngine, drafts: ProblemDraft[], maxProblems: number, creditsCharged: number): void {
    assert(this.state.status === 'PROCESSING', 'conversion.not_processing', 'Bộ đề đã được xử lý.');
    if (!drafts.length) {
      this.fail('Không tìm thấy bài tập nào trong tài liệu. Hãy kiểm tra nội dung hoặc thử dán văn bản đề.');
      return;
    }
    const kept = drafts.slice(0, maxProblems);
    const used = new Set<string>();
    this.problems = kept.map((draft, i) => {
      const code = uniqueCode(draft, i, used);
      const warnings = [...draft.warnings];
      if (i === 0 && drafts.length > maxProblems) {
        warnings.push(`Tài liệu có ${drafts.length} bài, gói hiện tại giữ tối đa ${maxProblems} bài mỗi lần.`);
      }
      return Problem.create({
        code,
        title: draft.title,
        statement: draft.statement,
        inputFormat: draft.inputFormat,
        outputFormat: draft.outputFormat,
        constraints: draft.constraints,
        timeLimitMs: draft.timeLimitMs,
        memoryLimitMb: draft.memoryLimitMb,
        tests: draft.samples.map((s) => ({ id: newId(), input: s.input, output: s.output, isSample: true, score: 1 })),
        warnings,
      });
    });
    this.state.engine = engine;
    this.state.status = 'READY';
    this.state.creditsCharged += creditsCharged;
  }

  fail(reason: string): void {
    this.state.status = 'FAILED';
    this.state.failure = reason;
  }

  // ---------- Editing (step 2) ----------

  problem(problemId: string): Problem {
    const problem = this.problems.find((p) => p.id === problemId);
    if (!problem) throw DomainError.notFound('problem.not_found', 'Không tìm thấy bài này trong bộ đề.');
    return problem;
  }

  updateProblem(problemId: string, changes: ProblemChanges): Problem {
    this.assertReady();
    const problem = this.problem(problemId);
    if (changes.code !== undefined) {
      const code = TaskCode.of(changes.code).value;
      assert(!this.problems.some((p) => p.id !== problemId && p.code === code), 'problem.duplicate_code',
        `Mã bài ${code} đã được dùng cho bài khác trong bộ đề.`);
    }
    problem.apply(changes);
    return problem;
  }

  addTests(problemId: string, tests: Omit<TestCaseState, 'id'>[]): Problem {
    this.assertReady();
    const problem = this.problem(problemId);
    problem.addTests(tests);
    return problem;
  }

  removeProblem(problemId: string): void {
    this.assertReady();
    this.problem(problemId);
    assert(this.problems.length > 1, 'conversion.last_problem', 'Bộ đề cần ít nhất một bài.');
    this.problems = this.problems.filter((p) => p.id !== problemId);
  }

  reorder(problemIds: string[]): void {
    this.assertReady();
    const ids = new Set(problemIds);
    assert(ids.size === this.problems.length && this.problems.every((p) => ids.has(p.id)), 'conversion.invalid_order',
      'Thứ tự bài không hợp lệ.');
    this.problems = problemIds.map((id) => this.problem(id));
  }

  updateSettings(changes: Partial<ContestSettings>, brandingAllowed: boolean): void {
    this.assertReady();
    this.state.settings = changeSettings(this.state.settings, changes, brandingAllowed);
  }

  charged(credits: number): void {
    this.state.creditsCharged += credits;
  }

  assertReady(): void {
    if (this.state.status === 'PROCESSING') throw DomainError.conflict('conversion.processing', 'Bộ đề đang được xử lý, vui lòng đợi.');
    if (this.state.status === 'FAILED') throw DomainError.conflict('conversion.failed', this.state.failure ?? 'Xử lý tài liệu không thành công.');
  }

  /**
   * Tasks Themis cannot judge yet. They are still exported (an empty task folder the teacher fills in Themis):
   * a guest whose document has no examples must still get their .contest.
   */
  tasksWithoutTests(): string[] {
    return this.problems.filter((p) => p.tests.length === 0).map((p) => p.code);
  }
}

function uniqueCode(draft: ProblemDraft, index: number, used: Set<string>): string {
  const candidates = [draft.code, TaskCode.statedIn(`${draft.inputFormat}\n${draft.outputFormat}\n${draft.statement}`), `BAI${index + 1}`];
  let code = candidates.map((c) => (c ? c.toUpperCase() : null)).find((c) => c && /^[A-Z][A-Z0-9_]{0,15}$/.test(c) && !used.has(c));
  for (let n = index + 1; !code; n++) if (!used.has(`BAI${n}`)) code = `BAI${n}`;
  used.add(code);
  return code;
}
