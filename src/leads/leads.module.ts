import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { AgentsModule } from '../agents/agents.module';
import { Lead } from '../entities/lead.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lead]), AgentsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}

