import { newId } from '../../../shared/domain/aggregate-root.js';
import { assert } from '../../../shared/domain/domain-error.js';

export const MAX_TESTS_PER_PROBLEM = 200;
export const MAX_TEST_BYTES = 512 * 1024;

export interface TestCaseState {
  id: string;
  input: string;
  output: string;
  isSample: boolean;
  score: number;
  purpose?: string;
  verified?: boolean;
}

/** Value object: one test (input file content, expected output content, points). */
export class TestCase {
  private constructor(readonly state: Readonly<TestCaseState>) {}

  static create(input: Omit<TestCaseState, 'id'> & { id?: string }): TestCase {
    const withNewline = (s: string) => (s === '' || s.endsWith('\n') ? s : `${s}\n`);
    const state: TestCaseState = {
      ...input,
      id: input.id || newId(),
      input: withNewline(input.input.replace(/\r\n?/g, '\n')),
      output: withNewline(input.output.replace(/\r\n?/g, '\n')),
    };
    assert(state.input.trim() || state.output.trim(), 'test.empty', 'Test phải có dữ liệu vào hoặc kết quả.');
    assert(Buffer.byteLength(state.input) + Buffer.byteLength(state.output) <= MAX_TEST_BYTES, 'test.too_large',
      'Mỗi test tối đa 512 KB. Test lớn hơn hãy sinh bằng chương trình rồi thêm trực tiếp vào Themis.');
    assert(Number.isFinite(state.score) && state.score >= 0 && state.score <= 100, 'test.invalid_score', 'Điểm mỗi test từ 0 đến 100.');
    return new TestCase(state);
  }
}
