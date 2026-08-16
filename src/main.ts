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

  const isProduction = process.env.PRODUCTION_MODE === 'true';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  // Updated CORS configuration
  app.enableCors({
    origin: isProduction 
      ? [frontendUrl] 
      : true, // `true` dynamically allows any origin in development (essential for Expo/Mobile devices)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Serve Static Assets
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public',
  });

  // Swagger setup
  const options = new DocumentBuilder()
    .setTitle(`${process.env.APP_NAME || 'App'} API`)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api/docs', app, document, {
    useGlobalPrefix: false,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 5000;
  
  // Binding to '0.0.0.0' allows connections from devices on your local network
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://192.168.1.4:${port}/api`);
}
bootstrap();