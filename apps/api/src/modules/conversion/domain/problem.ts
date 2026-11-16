import { newId } from '../../../shared/domain/aggregate-root.js';
import { assert } from '../../../shared/domain/domain-error.js';
import { MAX_TESTS_PER_PROBLEM, TestCase, type TestCaseState } from './test-case.js';
import { TaskCode } from './task-code.js';

export const TIME_LIMIT = { min: 100, max: 20_000 };
export const MEMORY_LIMIT = { min: 16, max: 2_048 };
const MAX_TEXT = 50_000;

export interface ProblemState {
  id: string;
  code: string;
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  tests: TestCaseState[];
  warnings: string[];
}

export type ProblemChanges = Partial<Omit<ProblemState, 'id' | 'tests' | 'warnings'>> & {
  tests?: (Omit<TestCaseState, 'id'> & { id?: string })[];
};

const clamp = (v: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : min)));

/** Entity inside a Conversion: one task of the future Themis contest. */
export class Problem {
  private constructor(private state: ProblemState) {}

  static create(input: Omit<ProblemState, 'id'>): Problem {
    const problem = new Problem({ ...input, id: newId(), tests: [] });
    problem.apply({ ...input, code: TaskCode.of(input.code).value, tests: input.tests });
    return problem;
  }

  static restore(state: ProblemState): Problem {
    return new Problem({ ...state, tests: [...state.tests], warnings: [...state.warnings] });
  }

  get id(): string { return this.state.id; }
  get code(): string { return this.state.code; }
  get title(): string { return this.state.title; }
  get tests(): readonly TestCaseState[] { return this.state.tests; }
  snapshot(): ProblemState { return { ...this.state, tests: [...this.state.tests], warnings: [...this.state.warnings] }; }

  apply(changes: ProblemChanges): void {
    const s = this.state;
    if (changes.code !== undefined) s.code = TaskCode.of(changes.code).value;
    if (changes.title !== undefined) {
      const title = changes.title.trim();
      assert(title.length >= 1 && title.length <= 200, 'problem.invalid_title', 'Tên bài phải từ 1 đến 200 ký tự.');
      s.title = title;
    }
    for (const field of ['statement', 'inputFormat', 'outputFormat', 'constraints'] as const) {
      const value = changes[field];
      if (value === undefined) continue;
      assert(value.length <= MAX_TEXT, 'problem.text_too_long', 'Mỗi mục của đề tối đa 50.000 ký tự.');
      s[field] = value;
    }
    if (changes.timeLimitMs !== undefined) s.timeLimitMs = clamp(changes.timeLimitMs, TIME_LIMIT);
    if (changes.memoryLimitMb !== undefined) s.memoryLimitMb = clamp(changes.memoryLimitMb, MEMORY_LIMIT);
    if (changes.tests !== undefined) {
      assert(changes.tests.length <= MAX_TESTS_PER_PROBLEM, 'problem.too_many_tests', `Mỗi bài tối đa ${MAX_TESTS_PER_PROBLEM} test.`);
      s.tests = changes.tests.map((t) => TestCase.create(t).state);
    }
  }

  addTests(tests: Omit<TestCaseState, 'id'>[]): void {
    this.apply({ tests: [...this.state.tests, ...tests] });
  }

  /** Warnings that still apply; the ones a teacher fixed disappear. */
  get openWarnings(): string[] {
    const s = this.state;
    const live = s.warnings.filter((w) => !(/ví dụ|test mẫu/i.test(w) && s.tests.length > 0));
    if (!s.tests.length) live.push('Chưa có test nào: Themis cần ít nhất một test để chấm.');
    return [...new Set(live)];
  }
}
