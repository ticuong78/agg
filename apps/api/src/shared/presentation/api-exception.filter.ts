import { Catch, HttpException, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiErrorBody } from '@agg/contracts';
import type { Response } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/domain-error.js';

const STATUS: Record<DomainErrorKind, number> = {
  validation: 400,
  unauthorized: 401,
  payment_required: 402,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};

const HTTP_CODES: Record<number, string> = {
  400: 'request.invalid',
  401: 'auth.required',
  403: 'auth.forbidden',
  404: 'request.not_found',
  413: 'request.too_large',
  429: 'request.rate_limited',
};

/** Maps domain errors and Nest HTTP exceptions to the shared `ApiErrorBody` shape. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let body: ApiErrorBody;
    if (exception instanceof DomainError) {
      if (exception.kind === 'rate_limited' && exception.details?.retryAfterSeconds) {
        res.setHeader('Retry-After', exception.details.retryAfterSeconds);
      }
      body = {
        statusCode: STATUS[exception.kind],
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    } else if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const raw = typeof payload === 'string' ? payload : (payload as { message?: string | string[] }).message;
      const statusCode = exception.getStatus();
      body = {
        statusCode,
        code: HTTP_CODES[statusCode] ?? (statusCode >= 500 ? 'server.error' : 'request.failed'),
        message: statusCode === 413 ? 'Tệp quá lớn so với giới hạn của gói.' : Array.isArray(raw) ? raw.join('; ') : (raw ?? exception.message),
      };
    } else {
      this.logger.error(exception);
      body = { statusCode: 500, code: 'server.error', message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại.' };
    }
    res.status(body.statusCode).json(body);
  }
}
