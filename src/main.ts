import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import * as express from 'express';
import logger from './logger/logger';

const maybeInitSentry = async (): Promise<void> => {
  if (process.env.ENABLE_SENTRY !== 'true' || !process.env.SENTRY_DSN) {
    return;
  }

  try {
    const importSentry = new Function(
      "return import('@sentry/node')",
    ) as () => Promise<{ init: (options: { dsn: string }) => void }>;
    const sentry = await importSentry();
    sentry.init({ dsn: process.env.SENTRY_DSN });
    logger.info('Sentry initialized');
  } catch (error) {
    logger.warn('Sentry initialization skipped', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }
};

async function bootstrap() {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      message: err.message,
      stack: err.stack,
    });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason });
  });

  await maybeInitSentry();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalFilters(new GlobalExceptionFilter());
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // ── URI versioning (/v1/) ──────────────────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ── Security headers (Helmet with strict CSP) ─────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  // ── CORS with allowlist ────────────────────────────────────────────────────
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // ── Request body size limits ───────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ── Global validation ──────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger / OpenAPI (disabled in production or behind auth) ──────────────
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Whspr API')
      .setDescription('EVM wallet-based authentication and Whspr platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Wallet authentication endpoints')
      .addTag('users', 'User profile management')
      .addTag('rooms', 'Chat room management')
      .addTag('payments', 'Token payments and tipping')
      .addTag('messages', 'Messaging endpoints')
      .addTag('admin', 'Admin management endpoints')
      .addTag('health', 'Health check probes')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);
  logger.info('Whspr API running', { url: `http://localhost:${port}` });
  if (!isProduction) {
    logger.info('Swagger docs available', {
      url: `http://localhost:${port}/docs`,
    });
    logger.info('OpenAPI JSON available', {
      url: `http://localhost:${port}/docs-json`,
    });
  }
}

bootstrap();
