import type { IoMode } from '@agg/contracts';
import type { ProblemState } from './problem.js';

/** The I/O line printed under a task title, as contestants expect it in a Themis contest. */
export function ioLine(problem: Pick<ProblemState, 'code' | 'timeLimitMs' | 'memoryLimitMb'>, ioMode: IoMode): string {
  const limits = `Thời gian: ${formatSeconds(problem.timeLimitMs)} giây/test · Bộ nhớ: ${problem.memoryLimitMb} MB`;
  const io = ioMode === 'FILE'
    ? `Tệp chương trình: ${problem.code}.* · Dữ liệu vào: ${problem.code}.INP · Kết quả: ${problem.code}.OUT`
    : `Tệp chương trình: ${problem.code}.* · Dữ liệu vào: bàn phím · Kết quả: màn hình`;
  return `${io}\n${limits}`;
}

export const formatSeconds = (ms: number): string => (ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

export const SECTION_TITLES = {
  statement: '',
  inputFormat: 'Dữ liệu vào',
  outputFormat: 'Kết quả',
  constraints: 'Ràng buộc',
} as const;
