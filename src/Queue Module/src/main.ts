import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module/app.module';
import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // In a real app, get queues from Nest's DI. For this demo, create adapters if needed.
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const { replaceQueues } = createBullBoard({ queues: [], serverAdapter });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use('/admin/queues', serverAdapter.getRouter());

  await app.listen(3000);
  console.log('Application listening on port 3000');
}

bootstrap();
