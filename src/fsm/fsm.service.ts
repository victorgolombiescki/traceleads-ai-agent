import { Injectable } from '@nestjs/common';
import { AgentOrchestrator } from './orchestrator';
import { ConversationHelperService } from './conversation-helper.service';
import { Agent } from '../entities/agent.entity';
import { Conversation } from '../entities/conversation.entity';

@Injectable()
export class FsmService {
  private orchestrator: AgentOrchestrator;

  constructor(private conversationHelper: ConversationHelperService) {
    this.orchestrator = new AgentOrchestrator(conversationHelper);
  }

  async startConversation(agent: Agent, companyId: number, externalId?: string): Promise<Conversation> {
    return this.orchestrator.startConversation(agent, companyId, externalId);
  }

  async processMessage(
    conversationId: number,
    agent: Agent,
    companyId: number,
    userMessage: string,
  ): Promise<{ response: string; conversation: Conversation }> {
    return this.orchestrator.processMessage(conversationId, agent, companyId, userMessage);
  }

  async getInitialGreeting(agent: Agent, conversation: Conversation): Promise<string> {
    return this.orchestrator.getInitialGreeting(agent, conversation);
  }
}

