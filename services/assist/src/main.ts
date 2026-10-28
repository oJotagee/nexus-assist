import 'reflect-metadata';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';

import { configureApp } from './app.setup';
import { AppModule } from './app.module';

const MIN_SECRET_LENGTH = 32;

async function bootstrap(): Promise<void> {
  if ((process.env.JWT_SECRET ?? '').length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET precisa ter ao menos ${MIN_SECRET_LENGTH} caracteres.`);
  }

  const app = configureApp(await NestFactory.create(AppModule));
  const port = process.env.PORT ?? '8081';

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Nexo Assist')
    .setDescription('Login, conversas, rascunhos de chamado, agent e console do analista.')
    .addBearerAuth()
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();
  await app.listen(port, '::');

  console.log(`Assist service running on http://localhost:${port} (docs em /api/docs)`);
}

bootstrap();
