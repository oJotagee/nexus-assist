import 'reflect-metadata';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';

import { configureApp } from './app.setup';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));

  const port = process.env.PORT ?? '8082';

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tickets Service (legado simulado)')
    .setDescription('Chamados do service desk. Rotas internas, protegidas por X-Internal-Secret.')
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();
  await app.listen(port, '::');

  console.log(`Tickets service running on http://localhost:${port} (docs em /api/docs)`);
}

bootstrap();
