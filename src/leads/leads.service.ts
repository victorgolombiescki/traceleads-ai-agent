import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../entities/lead.entity';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    private agentsService: AgentsService,
  ) {}

  async findByAgent(agentId: number, userId: number, companyId: number) {
    await this.agentsService.findOne(agentId, userId, companyId);
    return this.leadRepository.find({
      where: { agentId, companyId },
      order: { createdAt: 'DESC' },
    });
  }
}

