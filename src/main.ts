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
    
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.traceleads.com.br';
    const allowedOrigins = frontendUrl.split(',').map(url => url.trim()).filter(Boolean);
    
    if (!allowedOrigins.includes('https://app.traceleads.com.br')) {
      allowedOrigins.push('https://app.traceleads.com.br');
    }
    
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        
        // Verificar se a origin está permitida (comparação exata ou por hostname)
        const isAllowed = allowedOrigins.some(allowed => {
          if (origin === allowed) return true;
          // Comparar hostnames (ignorar protocolo e porta)
          try {
            const originUrl = new URL(origin);
            const allowedUrl = new URL(allowed);
            return originUrl.hostname === allowedUrl.hostname;
          } catch {
            return origin.startsWith(allowed);
          }
        });
        
        if (isAllowed) {
          return callback(null, true);
        }
        
        if (process.env.NODE_ENV !== 'production') {
          if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
            return callback(null, true);
          }
        }
        
        logger.warn(`CORS bloqueado para origin: ${origin}. Permitidas: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-widget-token', 'x-internal-service-key'],
    });
    logger.log(`CORS enabled for: ${allowedOrigins.join(', ')}`);

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

