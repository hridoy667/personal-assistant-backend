/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-floating-promises */
import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { join } from 'path';

console.log('DATABASE_URL at boot:', process.env.DATABASE_URL);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true, 
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration (Allows Mobile Apps + Cloudflare Tunnels)
  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: '*', // Allows all headers passed by Cloudflare/Axios
  });

  // Serve Static Assets
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public',
  });

  // Swagger setup mounted at /api/docs
  const options = new DocumentBuilder()
    .setTitle(`${process.env.APP_NAME || 'App'} API`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('docs', app, document);

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 5000;
  
  // Bind to '0.0.0.0' for local & tunnel availability
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}/api`);
}
bootstrap();