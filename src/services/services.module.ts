import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { LeadService } from './lead.service';
import { Lead } from '../entities/lead.entity';
import { Appointment } from '../entities/appointment.entity';
import { CalendarAvailability } from '../entities/calendar-availability.entity';
import { TraceLeadsAppointment } from '../entities/traceleads-appointment.entity';

@Global()
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      Lead,
      Appointment,
      CalendarAvailability,
      TraceLeadsAppointment,
    ]),
  ],
  providers: [CalendarService, LeadService],
  exports: [CalendarService, LeadService],
})
export class ServicesModule {}
