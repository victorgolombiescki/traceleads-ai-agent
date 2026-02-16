import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { LeadService } from './lead.service';
import { CalendarService } from './calendar.service';
import { Lead } from '../entities/lead.entity';
import { Appointment } from '../entities/appointment.entity';
import { CalendarAvailability } from '../entities/calendar-availability.entity';
import { TraceLeadsAppointment } from '../entities/traceleads-appointment.entity';
import { setLeadService } from './lead-service';
import { setCalendarService } from './calendar-service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Appointment, CalendarAvailability, TraceLeadsAppointment]),
    ConfigModule,
    HttpModule,
  ],
  providers: [
    LeadService,
    CalendarService,
    {
      provide: 'INIT_SERVICES',
      useFactory: (leadService: LeadService, calendarService: CalendarService) => {
        // Initialize singleton instances for FSM handlers
        setLeadService(leadService);
        setCalendarService(calendarService);
        return true;
      },
      inject: [LeadService, CalendarService],
    },
  ],
  exports: [LeadService, CalendarService],
})
export class ServicesModule {}

