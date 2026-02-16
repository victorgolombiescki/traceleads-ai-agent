import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CalendarService } from './calendar.service';
import { LeadService } from './lead.service';

@Module({
  imports: [HttpModule],
  providers: [CalendarService, LeadService],
  exports: [CalendarService, LeadService],
})
export class ServicesModule {}
