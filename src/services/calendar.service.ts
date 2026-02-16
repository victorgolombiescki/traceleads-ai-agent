import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { Agent } from '../entities/agent.entity';
import { CalendarAvailability, DayOfWeek } from '../entities/calendar-availability.entity';
import { TraceLeadsAppointment, AppointmentStatus as TraceLeadsAppointmentStatus } from '../entities/traceleads-appointment.entity';
import { firstValueFrom } from 'rxjs';

export interface TimeSlot {
  start: Date;
  end: Date;
  formatted: string;
  originalConfig: string;
}

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly traceleadsApiUrl: string;

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(CalendarAvailability)
    private calendarAvailabilityRepository: Repository<CalendarAvailability>,
    @InjectRepository(TraceLeadsAppointment)
    private traceleadsAppointmentRepository: Repository<TraceLeadsAppointment>,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.traceleadsApiUrl = this.configService.get<string>('TRACELEADS_API_URL') || 'http://localhost:3000';
  }

  async getAvailableSlots(
    agent: Agent,
    daysAhead: number = 14,
    maxSlots: number = 9,
    companyId?: number,
  ): Promise<TimeSlot[]> {
    const calendarUserId = (agent.behaviorConfig as any)?.calendarUserId;
    const enableCalendar = agent.behaviorConfig?.enableCalendar !== false;

    console.log(`[Calendar] getAvailableSlots called for agent ${agent.id}:`, {
      calendarUserId,
      enableCalendar,
      agentCompanyId: agent.companyId,
      passedCompanyId: companyId,
      behaviorConfig: agent.behaviorConfig
    });

    if (!enableCalendar) {
      console.warn(`[Calendar] Calendar disabled for agent ${agent.id}`);
      return [];
    }

    // Usar companyId do agente se não foi passado
    let finalCompanyId = companyId || agent.companyId;
    if (!finalCompanyId) {
      console.warn(`[Calendar] No companyId available for agent ${agent.id}`);
      return [];
    }

    // Buscar disponibilidades diretamente do banco
    console.log(`[Calendar] Searching for availabilities: companyId=${finalCompanyId}, calendarUserId=${calendarUserId || 'null'}`);
    
    const availabilityQuery = this.calendarAvailabilityRepository.createQueryBuilder('avail')
      .where('avail.companyId = :companyId', { companyId: finalCompanyId })
      .andWhere('avail.active = :active', { active: true });

    if (calendarUserId) {
      // Buscar disponibilidades do usuário específico OU disponibilidades gerais (userId IS NULL)
      availabilityQuery.andWhere('(avail.userId = :userId OR avail.userId IS NULL)', { userId: calendarUserId });
    } else {
      // Se não tiver calendarUserId, buscar apenas disponibilidades gerais
      availabilityQuery.andWhere('avail.userId IS NULL');
    }

    // Log do SQL gerado para debug manual
    const sql = availabilityQuery.getSql();
    const params = availabilityQuery.getParameters();
    console.log(`\n========== [Calendar] SQL DEBUG ==========`);
    console.log(`[Calendar] Query Builder SQL:`, sql);
    console.log(`[Calendar] Query Parameters:`, JSON.stringify(params, null, 2));
    console.log(`\n[Calendar] SQL para executar manualmente no PostgreSQL:`);
    if (calendarUserId) {
      console.log(`SELECT * FROM calendar_availability WHERE company_id = ${finalCompanyId} AND active = true AND (user_id = ${calendarUserId} OR user_id IS NULL) ORDER BY day_of_week, start_time;`);
    } else {
      console.log(`SELECT * FROM calendar_availability WHERE company_id = ${finalCompanyId} AND active = true AND user_id IS NULL ORDER BY day_of_week, start_time;`);
    }
    console.log(`\n[Calendar] Para ver TODAS as disponibilidades da empresa (sem filtro de userId):`);
    console.log(`SELECT * FROM calendar_availability WHERE company_id = ${finalCompanyId} AND active = true ORDER BY user_id, day_of_week, start_time;`);
    console.log(`==========================================\n`);

    const availabilities = await availabilityQuery.getMany();
    console.log(`[Calendar] Found ${availabilities.length} availabilities:`, availabilities.map(a => ({
      id: a.id,
      name: a.name,
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
      userId: a.userId,
      companyId: a.companyId
    })));

    if (availabilities.length === 0) {
      // Tentar buscar TODAS as disponibilidades da empresa (sem filtro de userId) para debug
      console.log(`[Calendar] Trying to find ALL availabilities for companyId ${finalCompanyId} (no userId filter):`);
      console.log(`SELECT * FROM calendar_availability WHERE company_id = ${finalCompanyId} AND active = true;`);
      const allAvailabilities = await this.calendarAvailabilityRepository.find({
        where: { companyId: finalCompanyId, active: true }
      });
      console.warn(`[Calendar] No availabilities found for companyId ${finalCompanyId}, userId ${calendarUserId || 'all'}`);
      console.warn(`[Calendar] But found ${allAvailabilities.length} total availabilities for companyId ${finalCompanyId}:`, 
        allAvailabilities.map(a => ({ id: a.id, userId: a.userId, dayOfWeek: a.dayOfWeek, startTime: a.startTime, endTime: a.endTime })));
      return [];
    }

    // Buscar slots disponíveis - 2 slots de 3 dias diferentes (total 6 slots)
    const slotsByDay: Map<string, TimeSlot[]> = new Map();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotsPerDay = 2;
    const targetDays = 3;

    for (let dayOffset = 0; dayOffset < daysAhead && slotsByDay.size < targetDays; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + dayOffset);
      const dayOfWeek = checkDate.getDay() === 0 ? 7 : checkDate.getDay(); // Ajustar domingo de 0 para 7
      const dateStr = checkDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Se já temos 2 slots deste dia, pular
      if (slotsByDay.has(dateStr) && slotsByDay.get(dateStr)!.length >= slotsPerDay) {
        continue;
      }

      // Filtrar disponibilidades para este dia da semana
      const dayAvailabilities = availabilities.filter(avail => avail.dayOfWeek === dayOfWeek);

      if (dayAvailabilities.length === 0) continue;

      // Buscar agendamentos confirmados para este dia
      const dayStart = new Date(checkDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(checkDate);
      dayEnd.setHours(23, 59, 59, 999);

      const appointmentsQuery = this.traceleadsAppointmentRepository.createQueryBuilder('apt')
        .where('apt.companyId = :companyId', { companyId: finalCompanyId })
        .andWhere('apt.scheduledAt >= :dayStart', { dayStart })
        .andWhere('apt.scheduledAt <= :dayEnd', { dayEnd })
        .andWhere('apt.status IN (:...statuses)', { 
          statuses: [TraceLeadsAppointmentStatus.CONFIRMED, TraceLeadsAppointmentStatus.PENDING] 
        });

      if (calendarUserId) {
        appointmentsQuery.andWhere('apt.userId = :userId', { userId: calendarUserId });
      }

      const appointments = await appointmentsQuery.getMany();
      const bookedTimeRanges = new Set<string>();
      
      appointments.forEach(apt => {
        const aptDate = new Date(apt.scheduledAt);
        const aptStart = new Date(aptDate);
        const aptEnd = new Date(aptStart.getTime() + 60 * 60 * 1000);
        
        let checkTime = new Date(aptStart);
        while (checkTime < aptEnd) {
          const timeStr = `${String(checkTime.getHours()).padStart(2, '0')}:${String(checkTime.getMinutes()).padStart(2, '0')}`;
          bookedTimeRanges.add(timeStr);
          checkTime = new Date(checkTime.getTime() + 15 * 60 * 1000); // Incrementar 15 minutos
        }
      });

      // Inicializar array de slots para este dia se não existir
      if (!slotsByDay.has(dateStr)) {
        slotsByDay.set(dateStr, []);
      }
      const daySlots = slotsByDay.get(dateStr)!;

      for (const availability of dayAvailabilities) {
        if (daySlots.length >= slotsPerDay) break;

        const [startHour, startMin] = availability.startTime.split(':').map(Number);
        const [endHour, endMin] = availability.endTime.split(':').map(Number);
        const slotDuration = availability.slotDuration * 60 * 1000; // Converter para ms

        const start = new Date(checkDate);
        start.setHours(startHour, startMin, 0, 0);
        const end = new Date(checkDate);
        end.setHours(endHour, endMin, 0, 0);

        let current = new Date(start);
        while (current < end && daySlots.length < slotsPerDay) {
          const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;
          
          let isSlotFree = true;
          let checkSlotTime = new Date(current);
          const slotEndCheck = new Date(current.getTime() + slotDuration);
          
          while (checkSlotTime < slotEndCheck && isSlotFree) {
            const checkTimeStr = `${String(checkSlotTime.getHours()).padStart(2, '0')}:${String(checkSlotTime.getMinutes()).padStart(2, '0')}`;
            if (bookedTimeRanges.has(checkTimeStr)) {
              isSlotFree = false;
            }
            checkSlotTime = new Date(checkSlotTime.getTime() + 15 * 60 * 1000); 
          }
          
          if (isSlotFree && current > new Date()) {
            const slotEnd = new Date(current.getTime() + slotDuration);
            const formatted = this.formatSlot(current, checkDate);
            
            daySlots.push({
              start: new Date(current),
              end: slotEnd,
              formatted,
              originalConfig: dateStr,
            });
          }

          current = new Date(current.getTime() + slotDuration);
        }
      }

      // Se não encontrou slots suficientes para este dia, remover do mapa
      if (daySlots.length === 0) {
        slotsByDay.delete(dateStr);
      }
    }

    // Combinar todos os slots de todos os dias
    const allSlots: TimeSlot[] = [];
    for (const daySlots of slotsByDay.values()) {
      allSlots.push(...daySlots);
    }

    console.log(`[Calendar] Generated ${allSlots.length} available slots from ${slotsByDay.size} different days`);
    console.log(`[Calendar] Slots by day:`, Array.from(slotsByDay.entries()).map(([date, slots]) => `${date}: ${slots.length} slots`));
    const finalSlots = allSlots.slice(0, maxSlots);
    console.log(`[Calendar] Returning ${finalSlots.length} slots:`, finalSlots.map(s => s.formatted));
    return finalSlots;
  }

  private formatSlot(slotTime: Date, date: Date): string {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = date.toLocaleDateString('pt-BR', { month: 'long' });
    const hours = String(slotTime.getHours()).padStart(2, '0');
    const minutes = String(slotTime.getMinutes()).padStart(2, '0');
    
    return `${dayName}, ${day} de ${month} às ${hours}:${minutes}`;
  }

  async createAppointment(data: {
    agentId: number;
    companyId: number;
    conversationId?: number;
    leadId?: number;
    scheduledAt: Date;
    duration?: number;
    status?: AppointmentStatus;
    notes?: string;
    metadata?: any;
    attendeeName?: string;
    attendeeEmail?: string;
    attendeePhone?: string;
    userId?: number;
  }): Promise<Appointment> {
    const appointment = this.appointmentRepository.create({
      agentId: data.agentId,
      companyId: data.companyId,
      conversationId: data.conversationId,
      leadId: data.leadId,
      scheduledAt: data.scheduledAt,
      duration: data.duration || 60,
      status: data.status || AppointmentStatus.SCHEDULED,
      notes: data.notes,
      metadata: data.metadata,
    });
    const savedAppointment = await this.appointmentRepository.save(appointment);

    if (data.attendeeName && data.attendeeEmail) {
      try {
        const scheduledAtDate = data.scheduledAt instanceof Date 
          ? data.scheduledAt 
          : new Date(data.scheduledAt);
        
        const title = data.attendeePhone 
          ? `${data.attendeeName} - ${data.attendeePhone}`
          : data.attendeeName || 'Agendamento via Agente de IA';

        const appointmentData = {
          attendeeName: data.attendeeName,
          attendeeEmail: data.attendeeEmail,
          attendeePhone: data.attendeePhone,
          scheduledAt: scheduledAtDate.toISOString(),
          title: title,
          notes: data.notes,
          userId: data.userId,
          companyId: data.companyId,
        };

        const internalServiceKey = this.configService.get<string>('INTERNAL_SERVICE_KEY') || process.env.INTERNAL_SERVICE_KEY;
        
        if (!internalServiceKey) {
          console.error('[Calendar] INTERNAL_SERVICE_KEY não configurada no .env do ai-agent-backend');
          throw new Error('INTERNAL_SERVICE_KEY não configurada');
        }
        
        console.log(`[Calendar] Enviando agendamento para traceleads-api com chave: ${internalServiceKey ? '***' + internalServiceKey.slice(-3) : 'NÃO CONFIGURADA'}`);
        
        await firstValueFrom(
          this.httpService.post(
            `${this.traceleadsApiUrl}/calendar/internal/appointments`,
            appointmentData,
            {
              headers: {
                'Content-Type': 'application/json',
                'x-internal-service-key': internalServiceKey,
              },
            }
          )
        );

        console.log(`[Calendar] Appointment created in traceleads-api for agent ${data.agentId}`);
      } catch (error: any) {
        console.error(`[Calendar] Error creating appointment in traceleads-api:`, error.message);
        // Não falha a criação do agendamento no ai-agent-backend se falhar no traceleads-api
      }
    }

    return savedAppointment;
  }

  async parseTimeSelection(
    userMessage: string,
    availableSlots: TimeSlot[],
  ): Promise<TimeSlot | null> {
    this.logger.debug(`[parseTimeSelection] Parsing: "${userMessage}"`);
    this.logger.debug(`[parseTimeSelection] Available slots: ${availableSlots.map((s, i) => `${i + 1}. ${s.formatted}`).join(', ')}`);

    // PRIORIDADE 1: Try to extract a number (option selection) - e.g., "1", "2", "opção 4"
    // Only match single-digit numbers at the start or after common prefixes
    const numberMatch = userMessage.match(/^(?:opção\s*|número\s*|a\s+opção\s*)?(\d+)(?:\s|$|\.|,)/i);
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1;
      if (index >= 0 && index < availableSlots.length) {
        this.logger.debug(`[parseTimeSelection] ✅ Matched by number: option ${numberMatch[1]} -> slot ${index} (${availableSlots[index].formatted})`);
        return availableSlots[index];
      }
    }

    const lowerMessage = userMessage.toLowerCase();
    
    // PRIORIDADE 2: Try to match by time FIRST (most specific)
    // Extract time patterns like "10:30", "09:00", "13:00", "às 10:30"
    const timePatterns = [
      /\bàs\s+(\d{1,2}):(\d{2})\b/,  // "às 10:30" - mais específico
      /\b(\d{1,2}):(\d{2})\b/,  // "10:30", "9:00"
      /\b(\d{1,2})h(\d{2})\b/,  // "10h30"
      /\b(\d{1,2})h\b/,  // "10h"
    ];

    for (const pattern of timePatterns) {
      const timeMatch = lowerMessage.match(pattern);
      if (timeMatch) {
        let hours: number;
        let minutes: number = 0;

        if (timeMatch[2] !== undefined) {
          // Pattern with minutes: "10:30" or "10h30" or "às 10:30"
          hours = parseInt(timeMatch[1]);
          minutes = parseInt(timeMatch[2]);
        } else {
          // Pattern without minutes: "10h"
          hours = parseInt(timeMatch[1]);
        }

        // Find slot matching this exact time
        for (const slot of availableSlots) {
          const slotDate = new Date(slot.start);
          const slotHours = slotDate.getHours();
          const slotMinutes = slotDate.getMinutes();

          if (slotHours === hours && slotMinutes === minutes) {
            this.logger.debug(`[parseTimeSelection] ✅ Matched by time: ${hours}:${minutes.toString().padStart(2, '0')} -> slot "${slot.formatted}"`);
            return slot;
          }
        }
      }
    }

    // PRIORIDADE 3: Try to match by full formatted string (exact match)
    for (const slot of availableSlots) {
      const lowerFormatted = slot.formatted.toLowerCase();
      // Check if the user message contains the full formatted slot
      if (lowerMessage.includes(lowerFormatted)) {
        this.logger.debug(`[parseTimeSelection] ✅ Matched by full format: "${lowerFormatted}"`);
        return slot;
      }
    }

    // PRIORIDADE 4: Try to match by day AND time parts separately (both must match)
    for (const slot of availableSlots) {
      const lowerFormatted = slot.formatted.toLowerCase();
      const parts = lowerFormatted.split(',');
      const dayPart = parts[0]?.trim() || '';
      const timePart = parts[1]?.trim() || '';
      
      // Extract time from timePart (e.g., "às 10:30" -> "10:30")
      const timeInSlot = timePart.match(/(\d{1,2}):(\d{2})/);
      const timeInMessage = lowerMessage.match(/(\d{1,2}):(\d{2})/);
      
      // Check if both day and time match
      if (dayPart && timePart) {
        const dayMatches = lowerMessage.includes(dayPart);
        const timeMatches = timeInSlot && timeInMessage && 
          timeInSlot[1] === timeInMessage[1] && 
          timeInSlot[2] === timeInMessage[2];
        
        if (dayMatches && timeMatches) {
          this.logger.debug(`[parseTimeSelection] ✅ Matched by day + time: "${dayPart}" + "${timePart}"`);
          return slot;
        }
      }
    }

    // PRIORIDADE 5: Last resort - match by day only (less precise, but better than nothing)
    // Only use this if no time was found in the message
    const hasTimeInMessage = /\d{1,2}[:h]\d{0,2}/.test(lowerMessage);
    if (!hasTimeInMessage) {
      for (const slot of availableSlots) {
        const lowerFormatted = slot.formatted.toLowerCase();
        const dayPart = lowerFormatted.split(',')[0]?.trim() || '';
        if (dayPart && lowerMessage.includes(dayPart)) {
          this.logger.debug(`[parseTimeSelection] ⚠️ Matched by day only: "${dayPart}" (less precise, no time found)`);
          return slot;
        }
      }
    }

    this.logger.debug(`[parseTimeSelection] ❌ No match found for: "${userMessage}"`);
    return null;
  }
}


