import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentsService } from '../agents/agents.service';
import { FsmService } from '../fsm/fsm.service';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { Agent } from '../entities/agent.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(Agent)
    private agentRepository: Repository<Agent>,
    private agentsService: AgentsService,
    private fsmService: FsmService,
  ) {}

  async start(
    agentId?: number, 
    externalId?: string, 
    widgetToken?: string,
    userId?: number,
    companyId?: number,
  ) {
    let agent: Agent;
    let finalCompanyId: number;

    if (widgetToken) {
      // Validação por widget token (público)
      agent = await this.agentsService.findByWidgetToken(widgetToken);
      finalCompanyId = agent.companyId;
    } else if (agentId) {
      // Se tiver userId e companyId (autenticado), usa eles
      if (userId && companyId) {
        agent = await this.agentsService.findOne(agentId, userId, companyId);
        finalCompanyId = companyId;
      } else {
        // Fallback: busca o agente sem filtro de userId/companyId (para compatibilidade)
        agent = await this.agentRepository.findOne({
          where: { id: agentId, isActive: true },
        });
        if (!agent) {
          throw new NotFoundException('Agent not found');
        }
        finalCompanyId = agent.companyId;
      }
    } else {
      throw new NotFoundException('Agent not found: widgetToken or agentId is required');
    }

    if (!agent || !agent.isActive) {
      throw new NotFoundException('Agent not found or inactive');
    }

    const conversation = await this.fsmService.startConversation(agent, finalCompanyId, externalId);
    const greeting = await this.fsmService.getInitialGreeting(agent, conversation);

    return {
      conversationId: conversation.id,
      greeting,
      agentConfig: {
        headerColor: agent.headerColor || '#1e3a5f',
        logoUrl: agent.logoUrl || null,
        companyName: agent.behaviorConfig?.companyName || null,
      },
    };
  }

  async sendMessage(conversationId: number, message: string, companyId?: number) {
    const whereClause: any = { id: conversationId };
    if (companyId) {
      whereClause.companyId = companyId;
    }

    const conversation = await this.conversationRepository.findOne({
      where: whereClause,
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const agent = await this.agentRepository.findOne({
      where: { id: conversation.agentId },
    });
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    const finalCompanyId = companyId || agent.companyId;
    const result = await this.fsmService.processMessage(conversationId, agent, finalCompanyId, message);

    return {
      response: result.response,
      currentState: result.conversation.currentState,
      status: result.conversation.status,
    };
  }

  async findOne(id: number, userId: number, companyId: number) {
    const conversation = await this.conversationRepository.findOne({
      where: { id, companyId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const agent = await this.agentsService.findOne(conversation.agentId, userId, companyId);
    const messages = await this.messageRepository.find({
      where: { conversationId: id, companyId },
      order: { createdAt: 'ASC' },
    });

    return {
      conversation,
      messages,
    };
  }

  async findByAgent(agentId: number, userId: number, companyId: number) {
    await this.agentsService.findOne(agentId, userId, companyId); // This will throw if not authorized
    return this.conversationRepository.find({
      where: { agentId, companyId },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
  }
}

