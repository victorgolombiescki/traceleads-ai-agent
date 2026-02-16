import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Agent } from '../entities/agent.entity';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Lead } from '../entities/lead.entity';
import { Appointment } from '../entities/appointment.entity';
import { CalendarAvailability } from '../entities/calendar-availability.entity';
import { TraceLeadsAppointment, AppointmentStatus as TraceLeadsAppointmentStatus } from '../entities/traceleads-appointment.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbHost = configService.get<string>('DB_HOST', 'localhost');
        const dbPort = configService.get<number>('DB_PORT', 5432);
        const dbUsername = configService.get<string>('DB_USERNAME');
        const dbPassword = configService.get<string>('DB_PASSWORD');
        const dbDatabase = configService.get<string>('DB_DATABASE');
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const sslEnabled = configService.get<string>('DATABASE_SSL') === 'true';
        
        if (!dbUsername || !dbPassword || !dbDatabase) {
          throw new Error('DB_USERNAME, DB_PASSWORD, and DB_DATABASE are required. Please set them in your .env file');
        }

        return {
          type: 'postgres',
          host: dbHost,
          port: dbPort,
          username: dbUsername,
          password: dbPassword,
          database: dbDatabase,
          entities: [User, Agent, Conversation, Message, Lead, Appointment, CalendarAvailability, TraceLeadsAppointment],
          synchronize: false, 
          logging: nodeEnv === 'development' ? ['error', 'warn', 'schema'] : false,
          ssl: sslEnabled ? {
            rejectUnauthorized: false,
          } : false,
          retryAttempts: 3,
          retryDelay: 3000,
        };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Agent,
      Conversation,
      Message,
      Lead,
      Appointment,
      CalendarAvailability,
      TraceLeadsAppointment,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
