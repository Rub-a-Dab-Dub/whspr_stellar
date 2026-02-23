import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AdminModule } from './admin/admin.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggingInterceptor } from './logger/logging.interceptor';
import { ValidationExceptionFilter } from './common/exceptions/filters/validation-exception.filter';
import { HttpExceptionFilter } from './common/exceptions/filters/http-exception.filter';
import { DatabaseExceptionFilter } from './common/exceptions/filters/database-exception.filter';
import { AllExceptionsFilter } from './common/exceptions/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ✅ Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,

      // 👇 IMPORTANT: makes validation errors structured
      exceptionFactory: (errors) => {
        return errors;
      },
    }),
  );

  // ✅ Global Exception Filters
  app.useGlobalFilters(
    new ValidationExceptionFilter(), // handles class-validator errors
    new HttpExceptionFilter(), // handles HttpException
    new DatabaseExceptionFilter(), // handles DB errors
    new AllExceptionsFilter(), // fallback for everything else
  );

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalInterceptors(new LoggingInterceptor());
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('helmet')());

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Admin API')
      .setDescription(
        'Admin dashboard API for user management, audit logs, and platform configuration',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config, {
      include: [AdminModule],
    });
    SwaggerModule.setup('admin/docs', app, document, {
      jsonDocumentUrl: 'admin/docs-json',
    });
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
