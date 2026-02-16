import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agent } from '../entities/agent.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private async ensureMockUser(userId: number): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      // Create mock user for testing
      const mockUser = this.userRepository.create({
        id: userId,
        openId: `test-user-${userId}`,
        name: 'Test User',
        email: 'test@example.com',
        role: 'admin',
      });
      await this.userRepository.save(mockUser);
    }
  }

  async findAll(userId: number, companyId: number): Promise<Agent[]> {
    return this.agentRepository.find({
      where: { userId, companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: number, companyId: number): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { id, userId, companyId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async findByWidgetToken(widgetToken: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({
      where: { widgetToken, isActive: true },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found or inactive');
    }
    return agent;
  }

  async create(
    userId: number,
    companyId: number,
    data: {
      name: string;
      description?: string;
      fsmConfig: any;
      behaviorConfig?: any;
      isActive?: boolean;
      widgetToken?: string;
    },
  ): Promise<Agent> {
    await this.ensureMockUser(userId);
    const widgetToken = data.widgetToken || this.generateWidgetToken();
    const agent = this.agentRepository.create({
      userId,
      companyId,
      ...data,
      widgetToken,
      isActive: data.isActive ?? true,
    });
    return this.agentRepository.save(agent);
  }

  async createDefault(userId: number, companyId: number, companyName: string): Promise<Agent> {
    await this.ensureMockUser(userId);
    const template = this.getDefaultProspectingTemplate(userId, companyId, companyName);
    const agent = this.agentRepository.create({
      ...template,
      widgetToken: this.generateWidgetToken(),
    });
    return this.agentRepository.save(agent);
  }

  async update(
    id: number,
    userId: number,
    companyId: number,
    data: Partial<Omit<Agent, 'id' | 'userId' | 'companyId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<void> {
    const agent = await this.findOne(id, userId, companyId);
    Object.assign(agent, data);
    await this.agentRepository.save(agent);
  }

  async remove(id: number, userId: number, companyId: number): Promise<void> {
    const agent = await this.findOne(id, userId, companyId);
    await this.agentRepository.remove(agent);
  }

  async updateAvailability(
    id: number,
    userId: number,
    companyId: number,
    data: {
      calendarConfig?: {
        workingHours: { start: number; end: number };
        workingDays: number[];
        slotDuration: number;
      };
      availabilityByDay?: Record<string, { start: string; end: string }>;
      availabilityByDateRange?: {
        startDate: string;
        endDate: string;
        startTime: string;
        endTime: string;
        daysOfWeek?: number[];
      };
      excludedSlots?: string[];
    },
  ): Promise<void> {
    const agent = await this.findOne(id, userId, companyId);
    
    const slotDuration = data.calendarConfig?.slotDuration || 60;
    const excludedSlots = data.excludedSlots || [];
    
    // Get existing slots (we'll ADD to them, not replace)
    const currentBehaviorConfig = agent.behaviorConfig || {};
    const existingSlots = currentBehaviorConfig.availableSlots || [];
    const existingExcludedSlots = currentBehaviorConfig.excludedSlots || [];
    
    // Generate new availableSlots from availabilityByDay ranges
    const newSlots: string[] = [];
    if (data.availabilityByDay) {
      Object.entries(data.availabilityByDay).forEach(([day, range]) => {
        // Parse start and end times (e.g., "08:00", "12:00")
        const [startHours, startMinutes] = range.start.split(':').map(Number);
        const [endHours, endMinutes] = range.end.split(':').map(Number);
        
        const startTotalMinutes = startHours * 60 + startMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        // Generate slots based on duration within the range
        let currentMinutes = startTotalMinutes;
        
        while (currentMinutes < endTotalMinutes) {
          const slotHours = Math.floor(currentMinutes / 60);
          const slotMins = currentMinutes % 60;
          const slotTime = `${String(slotHours).padStart(2, '0')}:${String(slotMins).padStart(2, '0')}`;
          const slotKey = `${day} ${slotTime}`;
          
          // Only add if not excluded and not already exists
          if (!excludedSlots.includes(slotKey) && !existingSlots.includes(slotKey)) {
            newSlots.push(slotKey);
          }
          
          currentMinutes += slotDuration;
        }
      });
    }

    // Generate slots from date range
    if (data.availabilityByDateRange) {
      const { startDate, endDate, startTime, endTime, daysOfWeek } = data.availabilityByDateRange;
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Parse time range
      const [startHours, startMinutes] = startTime.split(':').map(Number);
      const [endHours, endMinutes] = endTime.split(':').map(Number);
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      
      const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
      
      // Iterate through each date in the range
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay();
        
        // If daysOfWeek filter is provided, only process those days
        if (!daysOfWeek || daysOfWeek.includes(dayOfWeek)) {
          const dayName = dayNames[dayOfWeek];
          const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
          
          // Generate slots for this date
          let currentMinutes = startTotalMinutes;
          while (currentMinutes < endTotalMinutes) {
            const slotHours = Math.floor(currentMinutes / 60);
            const slotMins = currentMinutes % 60;
            const slotTime = `${String(slotHours).padStart(2, '0')}:${String(slotMins).padStart(2, '0')}`;
            // Format: "2024-01-15 08:00" for specific dates
            const slotKey = `${dateStr} ${slotTime}`;
            
            // Only add if not excluded and not already exists
            if (!excludedSlots.includes(slotKey) && !existingSlots.includes(slotKey)) {
              newSlots.push(slotKey);
            }
            
            currentMinutes += slotDuration;
          }
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Merge existing slots with new slots (additive, not replacement)
    const allSlots = [...new Set([...existingSlots, ...newSlots])];
    const allExcludedSlots = [...new Set([...existingExcludedSlots, ...excludedSlots])];

    // Update behaviorConfig
    agent.behaviorConfig = {
      ...currentBehaviorConfig,
      calendarConfig: data.calendarConfig || currentBehaviorConfig.calendarConfig,
      availableSlots: allSlots,
      excludedSlots: allExcludedSlots,
      enableCalendar: true,
    };

    await this.agentRepository.save(agent);
  }

  private generateWidgetToken(): string {
    // Gera um token único usando timestamp + random
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `widget_${timestamp}_${random}`;
  }

  private getDefaultProspectingTemplate(
    userId: number,
    companyId: number,
    companyName: string,
  ): Omit<Agent, 'id' | 'createdAt' | 'updatedAt' | 'user' | 'conversations' | 'leads' | 'appointments'> {
    return {
      userId,
      companyId,
      name: 'Agente de Prospecção',
      description: 'Agente para coletar dados de prospects e agendar reuniões',
      isActive: true,
      fsmConfig: {
        initialState: 'INITIALIZING',
        states: [
          { id: 'INITIALIZING', name: 'Inicializando', type: 'output', handlerClass: 'InitializingStateHandler' },
          { id: 'COLLECTING_NAME', name: 'Coletando Nome', type: 'input', handlerClass: 'CollectingNameStateHandler' },
          { id: 'COLLECTING_EMAIL', name: 'Coletando Email', type: 'input', handlerClass: 'CollectingEmailStateHandler' },
          { id: 'COLLECTING_PHONE', name: 'Coletando Telefone', type: 'input', handlerClass: 'CollectingPhoneStateHandler' },
          { id: 'CREATING_LEAD', name: 'Criando Lead', type: 'processing', handlerClass: 'CreatingLeadStateHandler' },
          { id: 'ASKING_STRATEGIC_QUESTIONS', name: 'Fazendo Perguntas', type: 'input', handlerClass: 'AskingQuestionsStateHandler' },
          { id: 'SHOWING_CALENDAR_OPTIONS', name: 'Mostrando Calendário', type: 'output', handlerClass: 'ShowingCalendarStateHandler' },
          { id: 'CONFIRMING_APPOINTMENT', name: 'Confirmando Agendamento', type: 'input', handlerClass: 'ConfirmingAppointmentStateHandler' },
          { id: 'COMPLETED', name: 'Concluído', type: 'terminal', handlerClass: 'CompletedStateHandler' },
          { id: 'ERROR', name: 'Erro', type: 'terminal', handlerClass: 'ErrorStateHandler' },
        ],
        transitions: {
          INITIALIZING: 'COLLECTING_NAME',
          COLLECTING_NAME: 'COLLECTING_EMAIL',
          COLLECTING_EMAIL: 'COLLECTING_PHONE',
          COLLECTING_PHONE: 'CREATING_LEAD',
          CREATING_LEAD: 'ASKING_STRATEGIC_QUESTIONS',
          ASKING_STRATEGIC_QUESTIONS: 'SHOWING_CALENDAR_OPTIONS',
          SHOWING_CALENDAR_OPTIONS: 'CONFIRMING_APPOINTMENT',
          CONFIRMING_APPOINTMENT: 'COMPLETED',
        },
      },
      behaviorConfig: {
        companyName,
        strategicQuestions: [
          'Qual é o principal desafio que você enfrenta atualmente no seu negócio?',
          'O que você espera alcançar nos próximos 6 meses?',
          'Você já tentou alguma solução para resolver esse problema? Como foi a experiência?',
        ],
        calendarConfig: {
          workingHours: { start: 9, end: 18 },
          workingDays: [1, 2, 3, 4, 5],
          slotDuration: 60,
        },
      },
    };
  }
}

