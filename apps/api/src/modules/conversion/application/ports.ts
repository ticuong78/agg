import type { CreditAction, ExportFormat, Features, IoMode, Limits, TextSection, Tier } from '@agg/contracts';
import type { Requester } from '../../../shared/application/requester.js';
import type { ContestSettings } from '../domain/contest-settings.js';
import type { ExamDocument } from '../domain/exam-document.js';
import type { ProblemState } from '../domain/problem.js';
import type { ProblemDraft } from '../domain/problem-draft.js';
import type { SourceFile } from '../domain/source-file.js';
import type { SourceKind } from '@agg/contracts';

/** An upload after its text layer was read (synchronously, before any AI work starts). */
export interface ReadSource {
  file: SourceFile;
  kind: SourceKind;
  document: ExamDocument | null;
  pages: number | null;
  /** A PDF without a usable text layer: only a visual (AI) read can get the problems out. */
  scanned: boolean;
  mediaType: string | null;
}

/** Port: reads the text layer of PDF, DOCX and text files. */
export abstract class DocumentReader {
  abstract read(file: SourceFile, kind: SourceKind): Promise<{ document: ExamDocument | null; pages: number | null }>;
}

/** Port: an AI that reads documents and images into problem drafts. Optional (needs an API key). */
export abstract class SmartReader {
  abstract get available(): boolean;
  /** `guest` reads the text layer with a cheaper model; `account` reads the original (layout, scans, images). */
  abstract read(source: ReadSource, mode: 'guest' | 'account'): Promise<ProblemDraft[]>;
}

/** Port: an AI that rewrites one section of a problem from the rest of it. */
export abstract class SectionWriter {
  abstract get available(): boolean;
  abstract write(section: TextSection, problem: ProblemState, ioMode: IoMode, instruction: string | null): Promise<{ text: string; notes: string[] }>;
}

export interface TestSuggestionContext {
  problem: ProblemState;
  count: number;
  focus: string | null;
}

export interface TestSuggestions {
  suggestions: { input: string; output: string; purpose: string; verified: boolean }[];
  notes: string[];
  focusRejections: string[];
}

/** Port: an AI that proposes tests and computes their outputs by running code. */
export abstract class TestSuggester {
  abstract get available(): boolean;
  abstract suggest(context: TestSuggestionContext): Promise<TestSuggestions>;
}

/** What exporters get: the structured contest, no aggregate behaviour. */
export interface ExportModel {
  settings: ContestSettings;
  problems: ProblemState[];
}

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

/** Port: one output format. */
export abstract class ContestExporter {
  abstract readonly format: ExportFormat;
  abstract export(model: ExportModel): Promise<ExportedFile>;
}

/** Port: all registered exporters. */
export abstract class ExporterRegistry {
  abstract get(format: ExportFormat): ContestExporter;
}

export interface UsageProfile {
  tier: Tier;
  limits: Limits;
  features: Features;
}

/** Port (anti-corruption layer) towards Billing: what the requester may do and what it costs. */
export abstract class UsageGateway {
  abstract profile(requester: Requester): Promise<UsageProfile>;
  /** Counts one conversion against the daily allowance of guests and free accounts; throws when it is used up. */
  abstract consumeConversion(requester: Requester, profile: UsageProfile): Promise<void>;
  /** Throws `payment_required` when the requester cannot pay `units` of `action`. */
  abstract assertCanAfford(requester: Requester, action: CreditAction, units: number): Promise<void>;
  /** Spends the credits; returns the balance left. */
  abstract charge(requester: Requester, action: CreditAction, units: number, reference: string): Promise<number>;
}

/** Port: runs extraction in the background. `priority` jobs go first (paid plans). */
export abstract class JobQueue {
  abstract enqueue(job: () => Promise<void>, priority: boolean): void;
}
