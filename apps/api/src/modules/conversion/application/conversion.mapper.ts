import type { ConversionDto, ConversionSummaryDto, ProblemDto } from '@agg/contracts';
import type { Conversion } from '../domain/conversion.js';
import type { Problem } from '../domain/problem.js';

export function toProblemDto(problem: Problem): ProblemDto {
  const s = problem.snapshot();
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    statement: s.statement,
    inputFormat: s.inputFormat,
    outputFormat: s.outputFormat,
    constraints: s.constraints,
    timeLimitMs: s.timeLimitMs,
    memoryLimitMb: s.memoryLimitMb,
    tests: s.tests.map((t) => ({ ...t })),
    warnings: problem.openWarnings,
  };
}

export function toConversionDto(conversion: Conversion): ConversionDto {
  const s = conversion.snapshot();
  return {
    id: s.id,
    status: s.status,
    engine: s.engine,
    sources: s.sources.map((src) => ({ ...src })),
    problems: conversion.problemList.map(toProblemDto),
    settings: { ...s.settings },
    failure: s.failure,
    creditsCharged: s.creditsCharged,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  };
}

export function toSummaryDto(conversion: Conversion): ConversionSummaryDto {
  const s = conversion.snapshot();
  return {
    id: s.id,
    name: s.settings.name,
    status: s.status,
    problemCount: s.problems.length,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  };
}
