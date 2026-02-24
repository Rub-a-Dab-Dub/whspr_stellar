import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true,
      transform: true, // auto-transform types
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('Withdrawal Approval API')
    .setDescription(
      'Admin interface for managing user withdrawal requests with auto-approval, ' +
        'risk scoring, audit logging, and on-chain queuing.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Withdrawals', 'User-facing withdrawal endpoints')
    .addTag('Admin - Withdrawals', 'Admin management of withdrawal requests')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  logger.log(
    `Auto-approve threshold: $${process.env.AUTO_APPROVE_WITHDRAWAL_THRESHOLD || '100'}`,
  );
}

bootstrap();
