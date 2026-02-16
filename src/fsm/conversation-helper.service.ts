import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationStatus } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import type { ConversationContext } from '../entities/conversation.entity';

@Injectable()
export class ConversationHelperService {
  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
  ) {}

  async createConversation(data: {
    agentId: number;
    companyId: number;
    externalId?: string;
    currentState: string;
    context: ConversationContext;
    status?: ConversationStatus;
  }): Promise<Conversation> {
    const conversation = this.conversationRepository.create({
      agentId: data.agentId,
      companyId: data.companyId,
      externalId: data.externalId,
      currentState: data.currentState,
      context: data.context,
      status: data.status || ConversationStatus.ACTIVE,
    });
    return this.conversationRepository.save(conversation);
  }

  async getConversationById(id: number, companyId: number): Promise<Conversation | null> {
    return this.conversationRepository.findOne({ where: { id, companyId } });
  }

  async updateConversationContext(id: number, companyId: number, context: ConversationContext): Promise<void> {
    await this.conversationRepository.update({ id, companyId }, {
      context,
      currentState: context.currentState,
    });
  }

  async updateConversationStatus(id: number, companyId: number, status: ConversationStatus | string): Promise<void> {
    const statusEnum = typeof status === 'string' ? (status as ConversationStatus) : status;
    const updates: any = { status: statusEnum };
    if (statusEnum === ConversationStatus.COMPLETED) {
      updates.completedAt = new Date();
    }
    await this.conversationRepository.update({ id, companyId }, updates);
  }

  async addMessage(data: {
    conversationId: number;
    companyId: number;
    role: 'user' | 'assistant';
    content: string;
    metadata?: any;
  }): Promise<Message> {
    const message = this.messageRepository.create({
      conversationId: data.conversationId,
      companyId: data.companyId,
      role: data.role,
      content: data.content,
      metadata: data.metadata,
    });
    return this.messageRepository.save(message);
  }
}

