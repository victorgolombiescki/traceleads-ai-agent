import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from './agents/agents.module';
import { ConversationsModule } from './conversations/conversations.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { FsmModule } from './fsm/fsm.module';
import { ServicesModule } from './services/services.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    ServicesModule,
    AuthModule,
    FsmModule,
    AgentsModule,
    ConversationsModule,
    LeadsModule,
    AppointmentsModule,
    HealthModule,
  ],
})
export class AppModule {}

