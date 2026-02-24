import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AdminModule } from './admin/admin.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggingInterceptor } from './logger/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
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
