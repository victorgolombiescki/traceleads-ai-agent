import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private agentsService: AgentsService,
  ) {}

  async findAll(userId: number, companyId: number) {
    const agents = await this.agentsService.findAll(userId, companyId);
    const agentIds = agents.map(a => a.id);
    
    if (agentIds.length === 0) {
      return [];
    }
    
    return this.appointmentRepository.find({
      where: { agentId: In(agentIds), companyId },
      order: { scheduledAt: 'ASC' },
    });
  }

  async findByAgent(agentId: number, userId: number, companyId: number) {
    await this.agentsService.findOne(agentId, userId, companyId);
    return this.appointmentRepository.find({
      where: { agentId, companyId },
      order: { scheduledAt: 'ASC' },
    });
  }
}

