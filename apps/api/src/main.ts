import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ACCESS_KEY_HEADER, VISITOR_HEADER } from '@agg/contracts';
import { parseTrustProxy } from './config/environment.js';
import { ApiExceptionFilter } from './shared/presentation/api-exception.filter.js';

async function bootstrap() {
  // Imported here so a configuration error is reported as a short message, not a stack trace.
  const { AppModule } = await import('./app.module.js');
  // rawBody: Stripe signs the exact bytes of its webhook body.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { abortOnError: false, rawBody: true });
  app.setGlobalPrefix('api');
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
    allowedHeaders: ['Content-Type', 'Authorization', VISITOR_HEADER, ACCESS_KEY_HEADER],
    // Downloads need the file name; 429 answers say how long to wait.
    exposedHeaders: ['Content-Disposition', 'Retry-After'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`API ready on http://localhost:${port}/api`);
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
