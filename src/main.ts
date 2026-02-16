import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create(AppModule, {
      logger: process.env.LOG_LEVEL === 'debug' 
        ? ['log', 'error', 'warn', 'debug', 'verbose']
        : ['log', 'error', 'warn'],
    });
    
    const frontendUrl = 'https://app.traceleads.com.br';
    const allowedOrigins = [frontendUrl, 'https://app.traceleads.com.br'].filter((v, i, a) => a.indexOf(v) === i);
    
    app.enableCors({
      origin: (origin, callback) => {
        if (origin) {
          return callback(null, origin);
        }
        // Apenas quando não há origin (Postman, curl, etc), permitir
        return callback(null, true);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-widget-token', 'x-internal-service-key'],
    });
    logger.log(`CORS enabled - aceitando todas as origins com credentials`);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen(port);
    
    logger.log(`🚀 Server running on http://localhost:${port}/`);
    logger.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Check required environment variables
    if (!process.env.DB_USERNAME || !process.env.DB_PASSWORD || !process.env.DB_DATABASE) {
      logger.warn('⚠️  DB_USERNAME, DB_PASSWORD, or DB_DATABASE not set - database connection may fail');
    }
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('⚠️  OPENAI_API_KEY not set - LLM features will not work');
    }
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();

