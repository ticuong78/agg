/** What a reader (AI or rule-based) extracted for one problem, before it becomes part of a conversion. */
export interface ProblemDraft {
  title: string;
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  samples: { input: string; output: string }[];
  warnings: string[];
  /** Task name the document gives (from "BAI1.INP", "Tên chương trình: SUM.CPP"...), if any. */
  code?: string;
}
